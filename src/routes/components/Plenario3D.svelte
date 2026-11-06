<script>
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { countUp } from '$lib/motion.js';
	import { COR, TIPOS, contar } from '$lib/votos.js';

	/** Every seat: registered votes plus absentees, one entry per deputy. */
	export let votos = [];
	export let chave = '';
	export let filtroVoto = '';
	export let filtroEstado = '';
	export let filtroPartido = '';
	export let filtroNome = '';
	/** Ids of women deputies, for the silhouettes. */
	export let mulheres = new Set();

	const dispatch = createEventDispatcher();
	const CADEIRAS = 513;
	const FILEIRAS = 11;
	const R0 = 0.47;
	const RAIO_MIN = 4.2;
	const RAIO_MAX = 11.4;
	const DEGRAU = 0.34;

	let host;
	let canvasEl;
	let hover = null;
	let tip = { x: 0, y: 0 };
	let pronto = false;

	// three.js state, created in onMount
	let THREE;
	let renderer;
	let scene;
	let camera;
	let raycaster;
	let geoHomem;
	let geoMulher;
	let material;
	let meshes = [];
	let cadeiras = [];
	let cores = {};
	let corApagada;
	let frame;
	let visivel = true;
	let ponteiro = { x: 0, y: 0, dentro: false };
	let camAlvo = { x: 0, y: 0 };
	let camAtual = { x: 0, y: 0 };
	let inicioAnim = 0;
	let reduzido = false;
	let observer;
	let resizeObs;

	// ---- data -------------------------------------------------------------
	$: ordenados = (() => {
		const registrados = votos.filter((v) => v.tipoVoto !== 'Ausentes');
		const vagas = Math.max(0, CADEIRAS - registrados.length);
		const ausentes = votos.filter((v) => v.tipoVoto === 'Ausentes').slice(0, vagas);
		return [...registrados, ...ausentes].sort((a, b) => {
			const t = TIPOS.indexOf(a.tipoVoto) - TIPOS.indexOf(b.tipoVoto);
			if (t) return t;
			return (a.deputado_?.siglaPartido || '').localeCompare(b.deputado_?.siglaPartido || '');
		});
	})();
	$: c = contar(ordenados);
	$: resultado = c.Sim >= c.Não ? 'Sim' : 'Não';

	function geometria(n) {
		if (!n) return [];
		const raios = Array.from({ length: FILEIRAS }, (_, i) => R0 + ((1 - R0) * i) / (FILEIRAS - 1));
		const soma = raios.reduce((a, b) => a + b, 0);
		const porFileira = raios.map((r) => Math.max(1, Math.round((n * r) / soma)));
		let diff = n - porFileira.reduce((a, b) => a + b, 0);
		for (let i = FILEIRAS - 1; diff !== 0; i = (i - 1 + FILEIRAS) % FILEIRAS) {
			porFileira[i] += Math.sign(diff);
			diff -= Math.sign(diff);
		}
		const pontos = [];
		raios.forEach((r, fileira) => {
			const k = porFileira[fileira];
			const margem = 0.035;
			for (let j = 0; j < k; j += 1) {
				const t = k === 1 ? 0.5 : j / (k - 1);
				const ang = Math.PI - margem - (Math.PI - 2 * margem) * t;
				pontos.push({ ang, fileira });
			}
		});
		return pontos.sort((a, b) => b.ang - a.ang || a.fileira - b.fileira);
	}

	function raioDaFileira(f) {
		return RAIO_MIN + ((RAIO_MAX - RAIO_MIN) * f) / (FILEIRAS - 1);
	}

	function apagada(v) {
		if (filtroVoto && v.tipoVoto !== filtroVoto) return true;
		if (filtroEstado && v.deputado_?.siglaUf !== filtroEstado) return true;
		if (filtroPartido && v.deputado_?.siglaPartido !== filtroPartido) return true;
		if (filtroNome && v.deputado_?.nome !== filtroNome) return true;
		return false;
	}

	// ---- scene ------------------------------------------------------------
	function corCss(nome, reserva) {
		const valor = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
		return valor || reserva;
	}

	function criarGeometrias(utils) {
		const corpoH = new THREE.CapsuleGeometry(0.15, 0.2, 4, 12);
		corpoH.translate(0, 0.25, 0);
		const cabecaH = new THREE.SphereGeometry(0.105, 14, 10);
		cabecaH.translate(0, 0.6, 0);
		geoHomem = utils.mergeGeometries([corpoH, cabecaH]);

		const corpoM = new THREE.CylinderGeometry(0.09, 0.19, 0.42, 14);
		corpoM.translate(0, 0.21, 0);
		const ombroM = new THREE.SphereGeometry(0.1, 12, 8);
		ombroM.scale(1.1, 0.7, 1);
		ombroM.translate(0, 0.42, 0);
		const cabecaM = new THREE.SphereGeometry(0.1, 14, 10);
		cabecaM.translate(0, 0.6, 0.01);
		const cabelo = new THREE.SphereGeometry(0.118, 14, 10);
		cabelo.scale(1, 1.25, 0.95);
		cabelo.translate(0, 0.57, -0.035);
		geoMulher = utils.mergeGeometries([corpoM, ombroM, cabecaM, cabelo]);
	}

	function criarBancadas() {
		const grupo = new THREE.Group();
		const matDegrau = new THREE.MeshLambertMaterial({ color: '#f3f3f6' });
		const matMesa = new THREE.MeshLambertMaterial({ color: '#e3e3e8' });
		for (let f = 0; f < FILEIRAS; f += 1) {
			const r = raioDaFileira(f);
			const meio = (raioDaFileira(1) - raioDaFileira(0)) / 2;
			const forma = new THREE.Shape();
			forma.absarc(0, 0, r + meio, 0, Math.PI, false);
			forma.absarc(0, 0, r - meio, Math.PI, 0, true);
			const degrau = new THREE.ExtrudeGeometry(forma, {
				depth: (f + 1) * DEGRAU,
				bevelEnabled: false,
				curveSegments: 64
			});
			degrau.rotateX(-Math.PI / 2);
			grupo.add(new THREE.Mesh(degrau, matDegrau));

			const mesaForma = new THREE.Shape();
			mesaForma.absarc(0, 0, r - meio * 0.45, 0, Math.PI, false);
			mesaForma.absarc(0, 0, r - meio * 0.8, Math.PI, 0, true);
			const mesa = new THREE.ExtrudeGeometry(mesaForma, {
				depth: 0.22,
				bevelEnabled: false,
				curveSegments: 64
			});
			mesa.rotateX(-Math.PI / 2);
			mesa.translate(0, (f + 1) * DEGRAU, 0);
			grupo.add(new THREE.Mesh(mesa, matMesa));
		}
		// The floor of the chamber and the speaker's table
		const piso = new THREE.Mesh(
			new THREE.CircleGeometry(RAIO_MIN - 0.4, 64, 0, Math.PI),
			new THREE.MeshLambertMaterial({ color: '#fafafb' })
		);
		piso.rotateX(-Math.PI / 2);
		piso.position.y = 0.002;
		grupo.add(piso);
		const mesaDiretora = new THREE.Mesh(
			new THREE.BoxGeometry(2.6, 0.5, 0.6),
			new THREE.MeshLambertMaterial({ color: '#dedee4' })
		);
		mesaDiretora.position.set(0, 0.25, -1.2);
		grupo.add(mesaDiretora);
		return grupo;
	}

	function montarCadeiras() {
		if (!scene) return;
		for (const m of meshes) {
			scene.remove(m);
			m.dispose();
		}
		meshes = [];
		const pontos = geometria(ordenados.length);
		const lista = ordenados.map((voto, i) => ({
			voto,
			...pontos[i],
			mulher: mulheres.has(voto.deputado_?.id)
		}));
		const qtd = [lista.filter((s) => !s.mulher).length, lista.filter((s) => s.mulher).length];
		const meshH = new THREE.InstancedMesh(geoHomem, material, Math.max(1, qtd[0]));
		const meshM = new THREE.InstancedMesh(geoMulher, material, Math.max(1, qtd[1]));
		meshH.count = qtd[0];
		meshM.count = qtd[1];
		for (const m of [meshH, meshM]) {
			m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
			m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, -4), 16);
			scene.add(m);
		}
		meshes = [meshH, meshM];
		const contadores = [0, 0];
		cadeiras = lista.map((s) => {
			const qual = s.mulher ? 1 : 0;
			const indice = contadores[qual]++;
			const r = raioDaFileira(s.fileira);
			const x = Math.cos(s.ang) * r;
			const z = -Math.sin(s.ang) * r;
			const y = (s.fileira + 1) * DEGRAU;
			const atraso = reduzido ? 0 : ((Math.PI - s.ang) / Math.PI) * 900 + s.fileira * 22;
			const cor = new THREE.Color(cores[s.voto.tipoVoto] || '#999');
			return {
				...s,
				mesh: meshes[qual],
				indice,
				pos: new THREE.Vector3(x, y, z),
				rotY: Math.atan2(-x, -z),
				atraso,
				escala: reduzido ? 1 : 0,
				foco: 1,
				cor: cor.clone(),
				corAlvo: cor
			};
		});
		inicioAnim = performance.now();
		atualizarCores(true);
		escreverMatrizes();
	}

	function atualizarCores(imediato = false) {
		for (const s of cadeiras) {
			const base = new THREE.Color(cores[s.voto.tipoVoto] || '#999');
			s.corAlvo = apagada(s.voto) ? base.lerp(corApagada, 0.86) : base;
			if (imediato) s.cor.copy(s.corAlvo);
		}
	}

	const dummy = { obj: null };
	function escreverMatrizes() {
		if (!dummy.obj) dummy.obj = new THREE.Object3D();
		const o = dummy.obj;
		for (const s of cadeiras) {
			const e = Math.max(0.0001, s.escala) * s.foco;
			o.position.copy(s.pos);
			o.position.y += (1 - Math.min(1, s.escala)) * -0.35;
			o.rotation.set(0, s.rotY, 0);
			o.scale.set(e, e, e);
			o.updateMatrix();
			s.mesh.setMatrixAt(s.indice, o.matrix);
			s.mesh.setColorAt(s.indice, s.cor);
		}
		for (const m of meshes) {
			m.instanceMatrix.needsUpdate = true;
			if (m.instanceColor) m.instanceColor.needsUpdate = true;
		}
	}

	function easeOutBack(t) {
		const c1 = 1.6;
		const c3 = c1 + 1;
		return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
	}

	function enquadrar() {
		if (!renderer || !host) return;
		const largura = host.clientWidth;
		const altura = Math.round(largura * (largura < 600 ? 0.7 : 0.46));
		renderer.setSize(largura, altura, false);
		canvasEl.style.width = `${largura}px`;
		canvasEl.style.height = `${altura}px`;
		camera.aspect = largura / altura;
		// Fit the full width of the chamber whatever the aspect ratio
		const meiaLargura = RAIO_MAX + 0.4;
		const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
		camera.userData.dist = Math.max(14, meiaLargura / tanH);
		camera.updateProjectionMatrix();
	}

	function posicionarCamera() {
		const d = camera.userData.dist || 20;
		camAtual.x += (camAlvo.x - camAtual.x) * 0.06;
		camAtual.y += (camAlvo.y - camAtual.y) * 0.06;
		const elev = 0.62 + camAtual.y * 0.08;
		camera.position.set(camAtual.x * 2.2, Math.sin(elev) * d, Math.cos(elev) * d - 3.2);
		camera.lookAt(0, 1.6, -5.2);
	}

	function loop(agora) {
		frame = requestAnimationFrame(loop);
		if (!visivel || !renderer) return;
		const t = agora - inicioAnim;
		let mexeu = false;
		for (const s of cadeiras) {
			const p = Math.min(1, Math.max(0, (t - s.atraso) / 620));
			const alvoEscala = reduzido ? 1 : easeOutBack(p);
			if (Math.abs(alvoEscala - s.escala) > 0.0005) {
				s.escala = alvoEscala;
				mexeu = true;
			}
			const focoAlvo = hover === s.voto ? 1.45 : 1;
			if (Math.abs(focoAlvo - s.foco) > 0.002) {
				s.foco += (focoAlvo - s.foco) * 0.25;
				mexeu = true;
			}
			if (!s.cor.equals(s.corAlvo)) {
				s.cor.lerp(s.corAlvo, 0.16);
				mexeu = true;
			}
		}
		if (mexeu) escreverMatrizes();
		posicionarCamera();
		renderer.render(scene, camera);
	}

	function aoMover(event) {
		if (!renderer) return;
		const caixa = canvasEl.getBoundingClientRect();
		const nx = ((event.clientX - caixa.left) / caixa.width) * 2 - 1;
		const ny = -((event.clientY - caixa.top) / caixa.height) * 2 + 1;
		ponteiro = { x: nx, y: ny, dentro: true };
		if (!reduzido) camAlvo = { x: nx, y: ny };
		raycaster.setFromCamera({ x: nx, y: ny }, camera);
		const hit = raycaster.intersectObjects(meshes, false)[0];
		if (hit && hit.instanceId != null) {
			const s = cadeiras.find((c) => c.mesh === hit.object && c.indice === hit.instanceId);
			hover = s ? s.voto : null;
		} else {
			hover = null;
		}
		const hostCaixa = host.getBoundingClientRect();
		tip = {
			x: Math.min(Math.max(event.clientX - hostCaixa.left, 130), hostCaixa.width - 130),
			y: event.clientY - hostCaixa.top
		};
		canvasEl.style.cursor = hover ? 'pointer' : 'default';
	}

	function aoSair() {
		hover = null;
		ponteiro.dentro = false;
		camAlvo = { x: 0, y: 0 };
	}

	function aoClicar(event) {
		aoMover(event);
		if (hover) dispatch('deputado', hover.deputado_?.nome);
	}

	onMount(async () => {
		reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		let utils;
		try {
			const teste = document.createElement('canvas');
			if (!(teste.getContext('webgl2') || teste.getContext('webgl'))) throw new Error('sem WebGL');
			THREE = await import('three');
			utils = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
			renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
		} catch (error) {
			dispatch('fallback', error?.message);
			return;
		}
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(30, 2, 0.1, 200);
		raycaster = new THREE.Raycaster();

		cores = Object.fromEntries(
			Object.entries({
				Sim: '--vote-sim',
				Não: '--vote-nao',
				Abstenção: '--vote-abstencao',
				Obstrução: '--vote-obstrucao',
				Ausentes: '--vote-ausentes'
			}).map(([tipo, v]) => [tipo, corCss(v, '#999999')])
		);
		corApagada = new THREE.Color(corCss('--color-light', '#ffffff'));

		scene.add(new THREE.HemisphereLight(0xffffff, 0xc9c9d2, 1.6));
		const sol = new THREE.DirectionalLight(0xffffff, 1.7);
		sol.position.set(-6, 14, 10);
		scene.add(sol);
		const contra = new THREE.DirectionalLight(0xffffff, 0.5);
		contra.position.set(8, 6, -12);
		scene.add(contra);

		criarGeometrias(utils);
		material = new THREE.MeshLambertMaterial({ color: 0xffffff });
		scene.add(criarBancadas());

		enquadrar();
		camAtual = { x: 0, y: 0 };
		montarCadeiras();
		pronto = true;

		resizeObs = new ResizeObserver(() => enquadrar());
		resizeObs.observe(host);
		observer = new IntersectionObserver((entradas) => {
			for (const e of entradas) visivel = e.isIntersecting;
		});
		observer.observe(host);
		frame = requestAnimationFrame(loop);
	});

	onDestroy(() => {
		cancelAnimationFrame(frame);
		observer?.disconnect();
		resizeObs?.disconnect();
		for (const m of meshes) m.dispose();
		geoHomem?.dispose();
		geoMulher?.dispose();
		material?.dispose();
		scene?.traverse((o) => {
			o.geometry?.dispose?.();
			o.material?.dispose?.();
		});
		renderer?.dispose();
	});

	// Rebuild seats when the vote changes; only recolour when a filter changes
	let chaveMontada = null;
	$: if (pronto && (chave !== chaveMontada || ordenados)) {
		if (chave !== chaveMontada || cadeiras.length !== ordenados.length) {
			chaveMontada = chave;
			montarCadeiras();
		}
	}
	$: if (pronto) {
		filtroVoto, filtroEstado, filtroPartido, filtroNome;
		atualizarCores();
	}
</script>

<figure class="p3d">
	<div
		class="p3d-stage"
		bind:this={host}
		on:pointermove={aoMover}
		on:pointerleave={aoSair}
		on:click={aoClicar}
		role="presentation"
	>
		<canvas
			bind:this={canvasEl}
			aria-label={`Plenário em 3D: ${c.Sim} sim, ${c.Não} não, ${c.Abstenção} abstenções, ${c.Obstrução} obstruções, ${c.Ausentes} ausentes`}
		/>
		{#if hover}
			<div class="p3d-tip" style={`left:${tip.x}px;top:${tip.y}px`}>
				<img src={hover.deputado_?.urlFoto} alt="" width="52" height="52" loading="lazy" />
				<div>
					<strong>{hover.deputado_?.nome}</strong>
					<span>{hover.deputado_?.siglaPartido} · {hover.deputado_?.siglaUf}</span>
					<em style={`--c:${COR[hover.tipoVoto]}`}>{hover.tipoVoto}</em>
				</div>
			</div>
		{/if}
	</div>

	<div class="p3d-placar">
		<span class="score score--sim"><b use:countUp={c.Sim}>0</b><small>sim</small></span>
		<span class="score-x">×</span>
		<span class="score score--nao"><b use:countUp={c.Não}>0</b><small>não</small></span>
		{#if c.Sim + c.Não > 0}
			<p>
				Venceu o <strong style={`color:${COR[resultado]}`}>{resultado.toLowerCase()}</strong>
				por {Math.abs(c.Sim - c.Não).toLocaleString('pt-BR')} votos
			</p>
		{/if}
	</div>

	<figcaption class="p3d-legend">
		{#each TIPOS as tipo}
			<button
				type="button"
				class="legend-item"
				class:legend-item--off={filtroVoto && filtroVoto !== tipo}
				on:click={() => dispatch('tipo', tipo)}
			>
				<i style={`background:${COR[tipo]}`} />
				{tipo}
				<b use:countUp={c[tipo]}>0</b>
			</button>
		{/each}
		<span class="legend-genero">
			<svg viewBox="0 0 20 24" aria-hidden="true"><circle cx="10" cy="5" r="4" /><path d="M3 23v-6a7 6 0 0 1 14 0v6z" /></svg>
			homem
			<svg viewBox="0 0 20 24" aria-hidden="true"><ellipse cx="10" cy="6" rx="5" ry="6" /><path d="M7 11l-5 12h16l-5-12z" /></svg>
			mulher
		</span>
	</figcaption>
</figure>

<style>
	.p3d {
		margin: 0;
	}

	.p3d-stage {
		position: relative;
	}

	canvas {
		display: block;
		width: 100%;
		touch-action: pan-y;
	}

	.p3d-tip {
		position: absolute;
		transform: translate(-50%, calc(-100% - 22px));
		display: flex;
		gap: calc(var(--grid) * 1.6);
		align-items: center;
		padding: calc(var(--grid) * 1.4) calc(var(--grid) * 2.4) calc(var(--grid) * 1.4)
			calc(var(--grid) * 1.4);
		background: var(--color-dark);
		color: var(--color-light);
		border-radius: 16px;
		box-shadow: var(--shadow-2);
		pointer-events: none;
		white-space: nowrap;
		z-index: 5;
		animation: tip-in 180ms var(--ease);
	}

	.p3d-tip::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 100%;
		transform: translateX(-50%);
		border: 8px solid transparent;
		border-top-color: var(--color-dark);
	}

	.p3d-tip img {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		object-fit: cover;
		background: color-mix(in srgb, var(--color-light) 20%, transparent);
	}

	.p3d-tip div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: var(--t-small);
		line-height: 1.3;
	}

	.p3d-tip strong {
		font-size: var(--t-caption);
	}

	.p3d-tip span {
		opacity: 0.7;
	}

	.p3d-tip em {
		font-style: normal;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.p3d-tip em::before {
		content: '';
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--c);
	}

	@keyframes tip-in {
		from {
			opacity: 0;
			transform: translate(-50%, calc(-100% - 12px));
		}
	}

	.p3d-placar {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: center;
		gap: 0 calc(var(--grid) * 1.6);
		margin-top: calc(var(--grid) * 1);
		font-family: var(--font-display);
	}

	.p3d-placar p {
		flex-basis: 100%;
		text-align: center;
		margin: calc(var(--grid) * 1) 0 0;
		font-family: var(--font-primary);
		font-size: calc(var(--grid) * 1.9);
		color: var(--color-text-muted);
	}

	.score {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
	}

	.score b {
		font-weight: 500;
		font-size: clamp(calc(var(--grid) * 4), 6vw, calc(var(--grid) * 6.5));
		line-height: 1;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}

	.score small {
		font-family: var(--font-primary);
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.score--sim {
		color: var(--vote-sim);
	}

	.score--nao {
		color: var(--vote-nao);
		flex-direction: row-reverse;
	}

	.score-x {
		font-size: calc(var(--grid) * 3);
		opacity: 0.35;
	}

	.p3d-legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: calc(var(--grid) * 0.6) calc(var(--grid) * 2);
		margin-top: calc(var(--grid) * 3);
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--grid) * 0.7);
		border: 0;
		background: none;
		padding: calc(var(--grid) * 0.4) 0;
		font: inherit;
		font-size: var(--t-caption);
		color: var(--color-dark);
		cursor: pointer;
		transition: opacity 180ms var(--ease);
	}

	.legend-item i {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		transition: transform 180ms var(--ease);
	}

	.legend-item:hover i {
		transform: scale(1.5);
	}

	.legend-item b {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.legend-item--off {
		opacity: 0.35;
	}

	.legend-genero {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--t-caption);
		color: var(--color-text-muted);
		padding-left: calc(var(--grid) * 2);
		border-left: 1px solid var(--color-rule);
	}

	.legend-genero svg {
		width: 14px;
		height: 17px;
		fill: currentColor;
	}

	.legend-genero svg + svg {
		margin-left: 8px;
	}
</style>
