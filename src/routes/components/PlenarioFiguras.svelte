<script>
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { countUp, manterNaTela, portal } from '$lib/motion.js';
	import { SILHUETAS } from '$lib/silhuetas.js';
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
	/** 513 in the Câmara, 81 in the Senado: fewer people stand in fewer, bigger rows. */
	export let cadeiras = 513;

	const dispatch = createEventDispatcher();
	$: CADEIRAS = cadeiras;
	$: FILEIRAS = cadeiras > 200 ? 12 : 5;
	const R0 = 0.4;
	// A floor plane seen in perspective; the chamber is a loose half ring on it.
	const LARGURA = 1000;
	const CENTRO_X = 500;
	const CHAO_Y = 560; // where the nearest feet stand
	const HORIZONTE_Y = 120; // where the plane would vanish
	const RAIO_X = 400;
	const PERTO = 1.1;
	const FUNDO = 1.5;
	$: FIG_ALTURA = cadeiras > 200 ? 70 : 104; // height of a person at the front, in drawing units
	const RODAPE = 30;
	const FOLGA_GRUPO = 0.018; // breathing room between vote groups, as a share of the arc
	const VARIANTES_H = ['h1', 'h2'];
	const VARIANTES_M = ['m1', 'm2'];
	const DURACAO = 1500;

	let host;
	let canvas;
	let ctx;
	let hover = null;
	let tip = { x: 0, y: 0, baixo: false };
	let caminhos = {};
	let cores = {};
	let figuras = [];
	let escalaCss = 1; // CSS pixels per drawing unit
	let topo = 0;
	let dpr = 1;
	let frame;
	let inicio = 0;
	let animando = false;
	let comecou = false;
	let reduzido = false;
	let observer;
	let resizeObs;
	let pronto = false;
	let inicioTroca = -1e9; // when the last change of vote started
	const DURACAO_TROCA = 1100;
	let camada; // full-window canvas used only while people walk in
	let ctxCamada;

	function ruido(i, sal) {
		const x = Math.sin(i * 127.1 + sal * 311.7) * 43758.5453;
		return x - Math.floor(x);
	}

	// ---- layout ------------------------------------------------------------
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

	// Seats in a half ring, but loose: no visible rows, everyone a little off the grid
	function lugares(n) {
		if (!n) return [];
		const raios = Array.from({ length: FILEIRAS }, (_, i) => R0 + ((1 - R0) * i) / (FILEIRAS - 1));
		const soma = raios.reduce((a, b) => a + b, 0);
		const porFileira = raios.map((r) => Math.max(1, Math.round((n * r) / soma)));
		let diff = n - porFileira.reduce((a, b) => a + b, 0);
		for (let i = FILEIRAS - 1; diff !== 0; i = (i - 1 + FILEIRAS) % FILEIRAS) {
			porFileira[i] += Math.sign(diff);
			diff -= Math.sign(diff);
		}
		const passoR = (1 - R0) / (FILEIRAS - 1);
		const pontos = [];
		raios.forEach((r, fileira) => {
			const k = porFileira[fileira];
			for (let j = 0; j < k; j += 1) {
				const i = pontos.length;
				const passo = 1 / Math.max(1, k);
				let t = (j + 0.5 + (fileira % 2 ? 0.25 : -0.25)) / k;
				t += (ruido(i, 1) - 0.5) * passo * 0.9;
				pontos.push({
					t: Math.min(1, Math.max(0, t)),
					r: r + (ruido(i, 2) - 0.5) * passoR * 0.95,
					fileira
				});
			}
		});
		// Left to right, so votes fill the ring in order
		return pontos.sort((a, b) => a.t - b.t || a.r - b.r);
	}

	function projetar(t, r) {
		const ang = Math.PI * (1 - t);
		const x = Math.cos(ang) * r;
		const prof = Math.sin(ang) * r; // 0 at the front corners, 1 at the back centre
		const escala = PERTO / (PERTO + prof * FUNDO);
		return {
			x: CENTRO_X + x * RAIO_X * escala * 1.18,
			y: HORIZONTE_Y + (CHAO_Y - HORIZONTE_Y) * escala,
			escala,
			prof
		};
	}

	function montar() {
		const pontos = lugares(ordenados.length);
		const grupos = TIPOS.filter((tipo) => ordenados.some((v) => v.tipoVoto === tipo));
		const encolhe = 1 - FOLGA_GRUPO * Math.max(0, grupos.length - 1);
		figuras = ordenados
			.map((voto, i) => {
				const p = pontos[i];
				const g = grupos.indexOf(voto.tipoVoto);
				const q = projetar(p.t * encolhe + g * FOLGA_GRUPO, p.r);
				const id = Number(voto.deputado_?.id) || i;
				const mulher = mulheres.has(voto.deputado_?.id) || voto.deputado_?.sexo === 'F';
				const lista = mulher ? VARIANTES_M : VARIANTES_H;
				const altura = FIG_ALTURA * q.escala * (0.93 + ruido(id, 3) * 0.12);
				return {
					voto,
					...q,
					altura,
					variante: lista[id % lista.length],
					// they come in from outside the window: a random side and spot (0..1)
					borda: Math.floor(ruido(id, 9) * 4),
					ao: ruido(id, 6),
					atraso: ruido(id, 8) * 900 + (1 - q.escala) * 600,
					alfa: 1,
					alfaAlvo: 1
				};
			})
			// back to front, so nearer people overlap those behind
			.sort((a, b) => b.prof - a.prof);
		topo = Math.min(...figuras.map((f) => f.y - f.altura), CHAO_Y) - 12;
		atualizarAlfas(true);
	}

	function apagada(v) {
		if (filtroVoto && v.tipoVoto !== filtroVoto) return true;
		if (filtroEstado && v.deputado_?.siglaUf !== filtroEstado) return true;
		if (filtroPartido && v.deputado_?.siglaPartido !== filtroPartido) return true;
		if (filtroNome && v.deputado_?.nome !== filtroNome) return true;
		return false;
	}

	function atualizarAlfas(imediato = false) {
		for (const f of figuras) {
			f.alfaAlvo = apagada(f.voto) ? 0.07 : 1;
			if (imediato) f.alfa = f.alfaAlvo;
		}
	}

	// ---- drawing -------------------------------------------------------------
	function corCss(nome, reserva) {
		const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
		return v || reserva;
	}

	function dimensionar() {
		if (!canvas || !host) return;
		const largura = host.clientWidth;
		if (!largura) return;
		escalaCss = largura / LARGURA;
		const altura = Math.round((CHAO_Y + RODAPE - topo) * escalaCss);
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(largura * dpr);
		canvas.height = Math.round(altura * dpr);
		canvas.style.height = `${altura}px`;
		desenhar(performance.now());
	}

	function suavizar(t) {
		return 1 - Math.pow(1 - t, 3);
	}

	// Each silhouette x vote style is drawn once into a small bitmap; every frame then just
	// stamps 513 bitmaps, instead of stroking and filling ~7,000 vector paths.
	const SPRITE_ESCALA = 2.4; // sprite pixels per silhouette unit (sharp up to ~170px tall)
	const SPRITE_MARGEM = 8;
	let sprites = new Map();

	// estado: 'normal'; 'forte' (passes an active filter); 'foco' (hovered or picked by name)
	function sprite(variante, tipo, estado) {
		const emFoco = estado === 'foco';
		const chave = `${variante}|${tipo}|${estado}`;
		let img = sprites.get(chave);
		if (img) return img;
		img = document.createElement('canvas');
		img.width = Math.ceil(40 * SPRITE_ESCALA + SPRITE_MARGEM * 2);
		img.height = Math.ceil(100 * SPRITE_ESCALA + SPRITE_MARGEM * 2);
		const c = img.getContext('2d');
		c.setTransform(SPRITE_ESCALA, 0, 0, SPRITE_ESCALA, SPRITE_MARGEM, SPRITE_MARGEM);
		const lista = caminhos[variante];
		const vazado = tipo === 'Ausentes' || tipo === 'Obstrução';
		// paper halo keeps overlapping people apart, without seams inside one person
		c.lineJoin = 'round';
		c.lineWidth = 5;
		c.strokeStyle = cores.papel;
		for (const p of lista) c.stroke(p);
		if (vazado && emFoco) {
			// someone picked who did not vote: a solid amber figure, never a faint outline
			c.fillStyle = cores.ambar;
		} else if (vazado) {
			const forte = estado === 'forte';
			c.lineWidth = forte ? 3.6 : 2.6;
			c.strokeStyle = tipo === 'Obstrução' || forte ? cores.Sim : cores.traco;
			for (const p of lista) c.stroke(p);
			c.fillStyle = cores.papel;
		} else {
			c.fillStyle = emFoco ? cores.ambar : cores[tipo];
		}
		for (const p of lista) c.fill(p);
		sprites.set(chave, img);
		return img;
	}

	function pintarPessoa(c, f, x, y, u, k, opac) {
		// x, y: feet position in device pixels; u: drawing units per silhouette unit
		if (opac <= 0.005) return;
		const escolhido = hover === f.voto || (filtroNome && f.voto.deputado_?.nome === filtroNome);
		const filtrando = filtroVoto || filtroEstado || filtroPartido || filtroNome;
		const estado = escolhido ? 'foco' : filtrando && f.alfaAlvo === 1 ? 'forte' : 'normal';
		const img = sprite(f.variante, f.voto.tipoVoto, estado);
		const fator = (u * k) / SPRITE_ESCALA;
		c.globalAlpha = opac;
		c.drawImage(
			img,
			x - (20 * SPRITE_ESCALA + SPRITE_MARGEM) * fator,
			y - (99.6 * SPRITE_ESCALA + SPRITE_MARGEM) * fator,
			img.width * fator,
			img.height * fator
		);
	}

	function abrirCamada() {
		if (camada) return;
		camada = document.createElement('canvas');
		camada.className = 'pf-camada';
		Object.assign(camada.style, {
			position: 'fixed',
			inset: '0',
			width: '100vw',
			height: '100vh',
			pointerEvents: 'none',
			zIndex: '15'
		});
		document.body.appendChild(camada);
		ctxCamada = camada.getContext('2d');
	}

	function fecharCamada() {
		camada?.remove();
		camada = null;
		ctxCamada = null;
	}

	function desenhar(agora) {
		if (!ctx) return;
		const t0 = agora - inicio;
		let mexendo = false;
		const chegando = !reduzido && comecou && t0 < 900 + 600 + DURACAO + 50;

		for (const f of figuras) {
			if (Math.abs(f.alfa - f.alfaAlvo) > 0.01) {
				f.alfa += (f.alfaAlvo - f.alfa) * 0.18;
				mexendo = true;
			} else {
				f.alfa = f.alfaAlvo;
			}
		}

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.imageSmoothingQuality = 'high';

		if (chegando) {
			// Walk in across the whole window, from outside it, onto the chamber
			abrirCamada();
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			if (camada.width !== Math.round(vw * dpr) || camada.height !== Math.round(vh * dpr)) {
				camada.width = Math.round(vw * dpr);
				camada.height = Math.round(vh * dpr);
			}
			ctxCamada.setTransform(1, 0, 0, 1, 0, 0);
			ctxCamada.clearRect(0, 0, camada.width, camada.height);
			ctxCamada.imageSmoothingQuality = 'high';
			const caixa = canvas.getBoundingClientRect();
			for (const f of figuras) {
				const p = Math.min(1, Math.max(0, (t0 - f.atraso) / DURACAO));
				if (p <= 0) continue;
				const alvoX = caixa.left + f.x * escalaCss;
				const alvoY = caixa.top + (f.y - topo) * escalaCss;
				const altura = f.altura * escalaCss; // CSS px
				const fora = altura + 30;
				const ox = f.borda === 0 ? -fora * 0.5 : f.borda === 1 ? vw + fora * 0.5 : f.ao * vw;
				const oy = f.borda === 2 ? vh + 20 : f.borda === 3 ? -20 : f.ao * vh;
				const e = suavizar(p);
				const x = ox + (alvoX - ox) * e;
				const y = oy + (alvoY - oy) * e;
				pintarPessoa(ctxCamada, f, x * dpr, y * dpr, f.altura / 100, escalaCss * dpr, f.alfa);
			}
			ctxCamada.globalAlpha = 1;
			mexendo = true;
		} else {
			fecharCamada();
			if (!reduzido && !comecou) {
				animando = false;
				return;
			}
			const k = escalaCss * dpr;
			const tt = agora - inicioTroca;
			const trocando = !reduzido && tt < 400 + DURACAO_TROCA;
			for (const f of figuras) {
				let x = f.x;
				let y = f.y;
				let u = f.altura / 100;
				let opac = f.alfa;
				if (trocando) {
					const p = Math.min(1, Math.max(0, (tt - f.atrasoTroca) / DURACAO_TROCA));
					const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
					if (f.de) {
						// same deputy, new place: walk across from where they stood
						x = f.de.x + (f.x - f.de.x) * e;
						y = f.de.y + (f.y - f.de.y) * e;
						u = (f.de.altura + (f.altura - f.de.altura) * e) / 100;
					} else {
						opac *= e;
					}
				}
				pintarPessoa(ctx, f, x * k, (y - topo) * k, u, k, opac);
			}
			ctx.globalAlpha = 1;
			if (trocando) mexendo = true;
		}

		if (mexendo) {
			animando = true;
			frame = requestAnimationFrame(desenhar);
		} else {
			animando = false;
		}
	}

	function redesenhar() {
		if (!animando && ctx) {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(desenhar);
		}
	}

	function comecar() {
		comecou = true;
		inicio = performance.now();
		animando = false;
		redesenhar();
	}

	// ---- interaction ---------------------------------------------------------
	function acertar(event) {
		const caixa = canvas.getBoundingClientRect();
		const x = (event.clientX - caixa.left) / escalaCss;
		const y = (event.clientY - caixa.top) / escalaCss + topo;
		// front to back: the nearest person under the cursor wins
		for (let i = figuras.length - 1; i >= 0; i -= 1) {
			const f = figuras[i];
			const meia = f.altura * 0.17;
			if (x >= f.x - meia && x <= f.x + meia && y <= f.y && y >= f.y - f.altura) return f;
		}
		return null;
	}

	// The tooltip points at the person's head, wherever the cursor touches them
	function ancorar(f) {
		const caixa = canvas.getBoundingClientRect();
		const x = caixa.left + f.x * escalaCss;
		const cabeca = caixa.top + (f.y - f.altura - topo) * escalaCss;
		const pes = caixa.top + (f.y - topo) * escalaCss;
		const baixo = cabeca < 230;
		tip = {
			x: Math.min(Math.max(x, 140), window.innerWidth - 140),
			y: baixo ? pes : cabeca,
			baixo
		};
	}

	function aoMover(event) {
		if (!figuras.length) return;
		const achado = acertar(event);
		const voto = achado?.voto ?? null;
		if (voto !== hover) {
			hover = voto;
			if (achado) ancorar(achado);
			redesenhar();
		}
		canvas.style.cursor = hover ? 'pointer' : 'default';
	}

	function aoSair(event) {
		// A finger lifting off the screen also fires pointerleave; that would close the
		// tooltip the tap just opened
		if (event?.pointerType === 'touch') return;
		if (hover) {
			hover = null;
			redesenhar();
		}
	}

	let ultimoToque = 'mouse';
	function aoTocar(event) {
		ultimoToque = event.pointerType;
	}

	function aoClicar(event) {
		const achado = acertar(event);
		// Touch: the first tap shows who it is, a second tap on the same person picks them
		if (ultimoToque === 'touch' || ultimoToque === 'pen') {
			if (!achado) {
				aoSair();
				return;
			}
			if (hover !== achado.voto) {
				hover = achado.voto;
				ancorar(achado);
				redesenhar();
				return;
			}
		}
		if (achado) dispatch('deputado', achado.voto.deputado_?.nome);
	}

	// Tapping anywhere outside the plenary closes the tooltip
	function aoTocarFora(event) {
		if (hover && event.pointerType !== 'mouse' && event.target !== canvas) {
			hover = null;
			redesenhar();
		}
	}

	onMount(() => {
		reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		ctx = canvas.getContext('2d');
		caminhos = Object.fromEntries(
			Object.entries(SILHUETAS).map(([nome, ds]) => [nome, ds.map((d) => new Path2D(d))])
		);
		cores = {
			Sim: corCss('--vote-sim', '#24475a'),
			Não: corCss('--vote-nao', '#8ea6b4'),
			Abstenção: corCss('--vote-abstencao', '#bccbd4'),
			Obstrução: corCss('--vote-obstrucao', '#4f7083'),
			Ausentes: corCss('--vote-ausentes', '#dce4e9'),
			traco: corCss('--vote-ausentes-traco', '#8aa0ad'),
			papel: corCss('--color-light', '#ffffff'),
			ambar: corCss('--accent-amber', '#d39b22')
		};
		montar();
		chaveMontada = chave;
		ordenadosMontados = ordenados;
		pronto = true;
		dimensionar();
		resizeObs = new ResizeObserver(() => dimensionar());
		resizeObs.observe(host);
		// The crowd walks in when the section comes into view
		observer = new IntersectionObserver(
			(entradas) => {
				if (entradas.some((e) => e.isIntersecting) && !comecou) comecar();
			},
			{ threshold: 0.2 }
		);
		observer.observe(host);
		// The tooltip is pinned to a person; hide it when the page moves under it
		window.addEventListener('scroll', aoRolar, { passive: true });
		window.addEventListener('pointerdown', aoTocarFora);
	});

	function aoRolar() {
		if (hover) {
			hover = null;
			redesenhar();
		}
	}

	onDestroy(() => {
		cancelAnimationFrame(frame);
		fecharCamada();
		if (typeof window !== 'undefined') {
			window.removeEventListener('scroll', aoRolar);
			window.removeEventListener('pointerdown', aoTocarFora);
		}
		observer?.disconnect();
		resizeObs?.disconnect();
	});

	// A new vote: everyone walks from where they stood to their place in the new vote,
	// changing group if their vote changed. A filter change only fades.
	// The vote id changes before the new votes arrive, so the layout follows the votes
	// themselves: rebuilding only on the id kept the previous vote's people on screen
	let chaveMontada = null;
	let ordenadosMontados = null;
	$: if (pronto && (chave !== chaveMontada || ordenados !== ordenadosMontados)) {
		const anteriores = new Map(figuras.map((f) => [f.voto.deputado_?.id, f]));
		chaveMontada = chave;
		ordenadosMontados = ordenados;
		montar();
		for (const f of figuras) {
			const id = f.voto.deputado_?.id;
			const a = anteriores.get(id);
			f.de = a ? { x: a.x, y: a.y, altura: a.altura } : null;
			f.atrasoTroca = ruido(Number(id) || 0, 10) * 400;
		}
		if (comecou && anteriores.size) inicioTroca = performance.now();
		cancelAnimationFrame(frame);
		animando = false;
		dimensionar();
	}
	$: if (pronto) {
		filtroVoto, filtroEstado, filtroPartido, filtroNome;
		atualizarAlfas();
		redesenhar();
	}
</script>

<figure class="pf">
	<div class="pf-stage" bind:this={host}>
		<canvas
			bind:this={canvas}
			on:pointermove={aoMover}
			on:pointerleave={aoSair}
			on:pointerdown={aoTocar}
			on:click={aoClicar}
			role="img"
			aria-label={`Plenário: ${c.Sim} sim, ${c.Não} não, ${c.Abstenção} abstenções, ${c.Obstrução} obstruções, ${c.Ausentes} ausentes`}
		/>
		{#if hover}
			<div class="pf-tip" class:pf-tip--baixo={tip.baixo} style={`left:${tip.x}px;top:${tip.y}px`} use:portal use:manterNaTela={tip}>
				<span class="retrato foto"><img src={hover.deputado_?.urlFoto} alt="" width="52" height="52" loading="lazy" /></span>
				<div>
					<strong>{hover.deputado_?.nome}</strong>
					<span>{hover.deputado_?.siglaPartido} · {hover.deputado_?.siglaUf}</span>
					<em style={`--c:${COR[hover.tipoVoto]}`}>{hover.situacao || hover.tipoVoto}</em>
				</div>
			</div>
		{/if}
	</div>

	<div class="pf-placar">
		<span class="score score--sim"><b use:countUp={c.Sim}>0</b><small>sim</small></span>
		<span class="score-x">×</span>
		<span class="score score--nao"><b use:countUp={c.Não}>0</b><small>não</small></span>
		{#if c.Sim + c.Não > 0}
			<p>
				Venceu o <strong>{resultado.toLowerCase()}</strong>
				por {Math.abs(c.Sim - c.Não).toLocaleString('pt-BR')} votos
			</p>
		{/if}
	</div>

	<figcaption class="pf-legend">
		{#each TIPOS as tipo}
			<button
				type="button"
				class="legend-item"
				class:legend-item--off={filtroVoto && filtroVoto !== tipo}
				on:click={() => dispatch('tipo', tipo)}
			>
				<svg viewBox="0 0 40 100" aria-hidden="true">
					{#each SILHUETAS.h1 as d}
						<path
							{d}
							class={`fig fig--${tipo === 'Não' ? 'nao' : tipo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}`}
						/>
					{/each}
				</svg>
				{tipo}
				<b use:countUp={c[tipo]}>0</b>
			</button>
		{/each}
	</figcaption>
</figure>

<style>
	.pf {
		margin: 0;
	}

	.pf-stage {
		position: relative;
	}

	canvas {
		display: block;
		width: 100%;
		touch-action: pan-y;
	}

	.fig--sim {
		fill: var(--vote-sim);
	}

	.fig--nao {
		fill: var(--vote-nao);
	}

	.fig--abstencao {
		fill: var(--vote-abstencao);
	}

	.fig--obstrucao {
		fill: var(--color-light);
		stroke: var(--vote-sim);
		stroke-width: 3;
	}

	.fig--ausentes {
		fill: var(--color-light);
		stroke: var(--vote-ausentes-traco);
		stroke-width: 3;
	}

	.pf-tip {
		position: fixed;
		margin-left: var(--desvio, 0px);
		transform: translate(-50%, calc(-100% - 14px));
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
		z-index: 1000;
		animation: tip-in 180ms var(--ease);
	}

	.pf-tip::after {
		content: '';
		position: absolute;
		left: calc(50% - var(--desvio, 0px));
		top: 100%;
		transform: translateX(-50%);
		border: 8px solid transparent;
		border-top-color: var(--color-dark);
	}

	.pf-tip--baixo {
		transform: translate(-50%, 14px);
		animation: none;
	}

	.pf-tip--baixo::after {
		top: auto;
		bottom: 100%;
		border-top-color: transparent;
		border-bottom-color: var(--color-dark);
	}

	.pf-tip .foto {
		width: 52px;
		height: 52px;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-light) 30%, transparent);
	}

	.pf-tip div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: var(--t-small);
		line-height: 1.3;
	}

	.pf-tip strong {
		font-size: var(--t-caption);
	}

	.pf-tip span {
		opacity: 0.7;
	}

	.pf-tip em {
		font-style: normal;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.pf-tip em::before {
		content: '';
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--c);
		box-shadow: 0 0 0 1.5px var(--color-light);
	}

	@keyframes tip-in {
		from {
			opacity: 0;
			transform: translate(-50%, calc(-100% - 12px));
		}
	}

	.pf-placar {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: center;
		gap: 0 calc(var(--grid) * 1.6);
		margin-top: calc(var(--grid) * 2);
		font-family: var(--font-display);
	}

	.pf-placar p {
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
		color: var(--vote-nao-texto);
		flex-direction: row-reverse;
	}

	.score-x {
		font-size: calc(var(--grid) * 3);
		opacity: 0.35;
	}

	.pf-legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: calc(var(--grid) * 0.6) calc(var(--grid) * 2.4);
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

	.legend-item svg {
		width: 10px;
		height: 25px;
		overflow: visible;
	}

	.legend-item b {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.legend-item--off {
		opacity: 0.35;
	}
</style>
