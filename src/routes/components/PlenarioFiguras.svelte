<script>
	import { createEventDispatcher } from 'svelte';
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
	const FILEIRAS = 12;
	const R0 = 0.4;
	// A floor plane seen in perspective: the chamber is a half disc on it, its open side
	// toward the viewer. Near people are big and low, far ones small and high.
	const LARGURA = 1000;
	const CENTRO_X = 500;
	const CHAO_Y = 560; // where the nearest feet stand
	const HORIZONTE_Y = 120; // where the plane would vanish
	const RAIO_X = 405; // x 1.18 at the front corners keeps everyone inside the 1000 width
	const PERTO = 1.1; // distance from the eye to the front corners
	const FUNDO = 1.5; // extra distance to the back of the chamber
	const FIG_ALTURA = 64; // height of a person at the front
	const VARIANTES_H = ['pf-h1', 'pf-h2'];
	const VARIANTES_M = ['pf-m1', 'pf-m2'];

	// Stable pseudo-random numbers, so the crowd does not reshuffle on every render
	function ruido(i, sal) {
		const x = Math.sin(i * 127.1 + sal * 311.7) * 43758.5453;
		return x - Math.floor(x);
	}

	let wrapEl;
	let hover = null;
	let tip = { x: 0, y: 0 };

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
			for (let j = 0; j < k; j += 1) {
				// Odd rows sit half a seat over, and everyone is nudged a little off the grid
				const n0 = pontos.length;
				const passo = 1 / Math.max(1, k - 1);
				let t = k === 1 ? 0.5 : fileira % 2 ? (j + 0.5) / k : j / (k - 1);
				t += (ruido(n0, 1) - 0.5) * passo * 0.5;
				t = Math.min(1, Math.max(0, t));
				const ang = Math.PI - Math.PI * t;
				const rr = r + (ruido(n0, 2) - 0.5) * ((1 - R0) / (FILEIRAS - 1)) * 0.55;
				pontos.push({ ang, r: rr, fileira, n0 });
			}
		});
		// Order by angle so votes fill the chamber from left to right
		return pontos.sort((a, b) => b.ang - a.ang || a.r - b.r);
	}

	// True perspective on the floor plane: size and height both follow 1 / distance
	function projetar(p) {
		const x = Math.cos(p.ang) * p.r;
		const prof = Math.sin(p.ang) * p.r; // 0 at the front corners, 1 at the back centre
		const escala = PERTO / (PERTO + prof * FUNDO);
		return {
			x: CENTRO_X + x * RAIO_X * escala * 1.18,
			y: HORIZONTE_Y + (CHAO_Y - HORIZONTE_Y) * escala,
			escala,
			prof
		};
	}

	$: pontos = geometria(ordenados.length);
	$: figuras = ordenados
		.map((voto, i) => {
			const p = pontos[i];
			const q = projetar(p);
			const mulher = mulheres.has(voto.deputado_?.id);
			const id = Number(voto.deputado_?.id) || i;
			const lista = mulher ? VARIANTES_M : VARIANTES_H;
			return {
				voto,
				...q,
				mulher,
				variante: lista[id % lista.length],
				altura: FIG_ALTURA * q.escala * (0.94 + ruido(id, 3) * 0.1),
				atraso: Math.round(((Math.PI - p.ang) / Math.PI) * 700 + p.fileira * 20)
			};
		})
		// Paint from the back to the front so nearer people overlap those behind
		.sort((a, b) => b.prof - a.prof);
	$: c = contar(ordenados);
	$: resultado = c.Sim >= c.Não ? 'Sim' : 'Não';
	$: topo = Math.min(...figuras.map((f) => f.y - f.altura), CHAO_Y) - 10;

	function apagada(v, filtroVoto, filtroEstado, filtroPartido, filtroNome) {
		if (filtroVoto && v.tipoVoto !== filtroVoto) return true;
		if (filtroEstado && v.deputado_?.siglaUf !== filtroEstado) return true;
		if (filtroPartido && v.deputado_?.siglaPartido !== filtroPartido) return true;
		if (filtroNome && v.deputado_?.nome !== filtroNome) return true;
		return false;
	}

	function mostrar(event, f) {
		hover = f.voto;
		mover(event);
	}

	function mover(event) {
		if (!wrapEl) return;
		const caixa = wrapEl.getBoundingClientRect();
		const x = (event.clientX ?? caixa.left + caixa.width / 2) - caixa.left;
		const y = (event.clientY ?? caixa.top) - caixa.top;
		tip = { x: Math.min(Math.max(x, 130), caixa.width - 130), y };
	}
</script>

<figure class="pf">
	<div class="pf-stage" bind:this={wrapEl} on:mouseleave={() => (hover = null)}>
		{#key chave}
			<svg
				viewBox={`0 ${topo} ${LARGURA} ${CHAO_Y + 14 - topo}`}
				role="img"
				aria-label={`Plenário: ${c.Sim} sim, ${c.Não} não, ${c.Abstenção} abstenções, ${c.Obstrução} obstruções, ${c.Ausentes} ausentes`}
			>
				<defs>
					<!-- Standing politicians, 40 x 100, feet at the bottom centre. Drawn for this page. -->
					<g id="pf-h1">
						<path d="M20 1.6C24.2 1.6 26.6 4.6 26.3 8.8C26 12.8 23.6 15.8 20 15.8C16.4 15.8 14 12.8 13.7 8.8C13.4 4.6 15.8 1.6 20 1.6Z" />
						<path d="M17.4 14.6H22.6V19.4H17.4Z" />
						<path d="M12 19.4L17.4 18L20 23L22.6 18L28 19.4C29.8 19.9 30.4 21.2 30.4 23.2L29.4 58.4L27.2 97.4C27.2 98.8 26.2 99.4 24.4 99.4H21.2L20.6 62.6H19.4L18.8 99.4H15.6C13.8 99.4 12.8 98.8 12.8 97.4L10.6 58.4L9.6 23.2C9.6 21.2 10.2 19.9 12 19.4Z" />
						<path d="M9 20.8C7.1 21.3 6.2 22.7 6.1 24.8L5.1 52C5 54 5.8 55.6 7.3 55.6C8.6 55.6 9.3 54.6 9.4 53L9.9 31Z" />
						<path d="M31 20.8C32.9 21.3 33.8 22.7 33.9 24.8L34.9 52C35 54 34.2 55.6 32.7 55.6C31.4 55.6 30.7 54.6 30.6 53L30.1 31Z" />
					</g>
					<g id="pf-h2">
						<path d="M20 1.4C24.4 1.4 26.8 4.4 26.5 8.8C26.2 12.8 23.8 15.8 20 15.8C16.2 15.8 13.8 12.8 13.5 8.8C13.2 4.4 15.6 1.4 20 1.4Z" />
						<path d="M17.4 14.6H22.6V19.4H17.4Z" />
						<path d="M11.6 19.4L17.4 18L20 23L22.6 18L28.4 19.4C30.4 19.9 31 21.2 31 23.4L29.8 58.4L27.6 97.4C27.6 98.8 26.6 99.4 24.8 99.4H21.2L20.6 62.6H19.4L18.8 99.4H15.2C13.4 99.4 12.4 98.8 12.4 97.4L10.2 58.4L9 23.4C9 21.2 9.6 19.9 11.6 19.4Z" />
						<path d="M8.8 20.9C6.8 21.5 5.9 23 5.9 25.2L5.8 40.4C5.8 43.4 7.2 45.4 9.8 47.2L17.4 52.6C18.8 53.6 20.6 53.2 21 51.8C21.3 50.5 20.4 49.6 19.4 49L11.6 43.2L10.4 31Z" />
						<path d="M31.2 20.9C33.2 21.5 34.1 23 34.1 25.2L34.2 40.4C34.2 43.4 32.8 45.4 30.2 47.2L22.6 52.6C21.2 53.6 19.4 53.2 19 51.8C18.7 50.5 19.6 49.6 20.6 49L28.4 43.2L29.6 31Z" />
					</g>
					<g id="pf-m1">
						<path d="M20 1.4C25.6 1.4 27.6 5.6 27.2 10.2L27.8 18.8C25.6 20.2 22.8 20.6 20 20.6C17.2 20.6 14.4 20.2 12.2 18.8L12.8 10.2C12.4 5.6 14.4 1.4 20 1.4Z" />
						<path d="M13.2 20.6L17.6 19.4L20 22.6L22.4 19.4L26.8 20.6C28.4 21 29 22.2 29 24.2L28 40C27.8 42 27.4 44 27.6 46L30.4 69C30.6 70.4 29.6 71 28.2 71H11.8C10.4 71 9.4 70.4 9.6 69L12.4 46C12.6 44 12.2 42 12 40L11 24.2C11 22.2 11.6 21 13.2 20.6Z" />
						<path d="M14.4 70H18.4L17.8 94.6L18.8 97.2C19.2 98.6 18.4 99.4 16.6 99.4H15.2C14.2 99.4 13.9 98.8 14.4 98L15.4 94.6Z" />
						<path d="M21.6 70H25.6L24.6 94.6L25.6 98C26.1 98.8 25.8 99.4 24.8 99.4H23.4C21.6 99.4 20.8 98.6 21.2 97.2L22.2 94.6Z" />
						<path d="M11.4 21.6C9.6 22.2 8.8 23.6 8.8 25.6L8.3 50.8C8.2 52.7 8.9 54 10.1 54C11.2 54 11.7 53.1 11.8 51.8L12.1 30Z" />
						<path d="M28.6 21.6C30.4 22.2 31.2 23.6 31.2 25.6L31.7 50.8C31.8 52.7 31.1 54 29.9 54C28.8 54 28.3 53.1 28.2 51.8L27.9 30Z" />
					</g>
					<g id="pf-m2">
						<circle cx="20" cy="3.6" r="3.4" />
						<path d="M20 4.2C24 4.2 26 7 25.8 10.6C25.6 14.2 23.4 16.6 20 16.6C16.6 16.6 14.4 14.2 14.2 10.6C14 7 16 4.2 20 4.2Z" />
						<path d="M17.8 15.6H22.2V20H17.8Z" />
						<path d="M13 20.2L17.8 19L20 22.8L22.2 19L27 20.2C28.6 20.6 29.2 21.8 29.2 23.8L28.4 56.6L26.6 97.4C26.6 98.8 25.6 99.4 24 99.4H21.2L20.6 63H19.4L18.8 99.4H16C14.4 99.4 13.4 98.8 13.4 97.4L11.6 56.6L10.8 23.8C10.8 21.8 11.4 20.6 13 20.2Z" />
						<path d="M10.2 21.4C8.4 22 7.6 23.4 7.6 25.4L7 51.2C6.9 53.1 7.6 54.4 8.8 54.4C9.9 54.4 10.4 53.5 10.5 52.2L11 30Z" />
						<path d="M29.8 21.4C31.6 22 32.4 23.4 32.4 25.4L33 51.2C33.1 53.1 32.4 54.4 31.2 54.4C30.1 54.4 29.6 53.5 29.5 52.2L29 30Z" />
					</g>
				</defs>

				{#each figuras as f (f.voto)}
					<ellipse
						class="sombra"
						class:sombra--off={apagada(f.voto, filtroVoto, filtroEstado, filtroPartido, filtroNome)}
						cx={f.x.toFixed(1)}
						cy={f.y.toFixed(1)}
						rx={(f.altura * 0.22).toFixed(1)}
						ry={(f.altura * 0.045).toFixed(1)}
					/>
				{/each}

				{#each figuras as f, i (i)}
					<g transform={`translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) scale(${(f.altura / 100).toFixed(4)})`}>
						<use
							href={`#${f.variante}`}
							x="-20"
							y="-99.6"
							class="halo"
							class:halo--off={apagada(f.voto, filtroVoto, filtroEstado, filtroPartido, filtroNome)}
							style={`--d:${f.atraso}ms`}
							aria-hidden="true"
						/>
						<use
							href={`#${f.variante}`}
							x="-20"
							y="-99.6"
							class={`fig fig--${f.voto.tipoVoto === 'Não' ? 'nao' : f.voto.tipoVoto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}`}
							class:fig--off={apagada(f.voto, filtroVoto, filtroEstado, filtroPartido, filtroNome)}
							class:fig--on={hover === f.voto}
							style={`--d:${f.atraso}ms`}
							on:mouseenter={(e) => mostrar(e, f)}
							on:mousemove={mover}
							on:click={() => dispatch('deputado', f.voto.deputado_?.nome)}
							on:keydown={(e) => e.key === 'Enter' && dispatch('deputado', f.voto.deputado_?.nome)}
							role="button"
							tabindex="-1"
							aria-label={`${f.voto.deputado_?.nome}: ${f.voto.tipoVoto}`}
						/>
					</g>
				{/each}
			</svg>
		{/key}

		{#if hover}
			<div class="pf-tip" style={`left:${tip.x}px;top:${tip.y}px`}>
				<img src={hover.deputado_?.urlFoto} alt="" width="52" height="52" loading="lazy" />
				<div>
					<strong>{hover.deputado_?.nome}</strong>
					<span>{hover.deputado_?.siglaPartido} · {hover.deputado_?.siglaUf}</span>
					<em style={`--c:${COR[hover.tipoVoto]}`}>{hover.tipoVoto}</em>
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
					<use
						href="#pf-h1"
						class={`fig fig--${tipo === 'Não' ? 'nao' : tipo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}`}
					/>
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

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.pf-piso {
		fill: var(--color-track);
		opacity: 0.6;
	}

	.fig {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		cursor: pointer;
		animation: fig-in 560ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: var(--d);
		transition: opacity 360ms var(--ease), transform 180ms var(--ease), fill 360ms var(--ease);
	}

	@keyframes fig-in {
		from {
			opacity: 0;
			transform: translateY(14px) scaleY(0.6);
		}
	}

	.sombra {
		fill: var(--vote-sim);
		opacity: 0.08;
		transition: opacity 360ms var(--ease);
	}

	.sombra--off {
		opacity: 0.02;
	}

	/* A paper-coloured halo behind each person separates overlapping people
	   without drawing seams inside a figure */
	.halo {
		fill: var(--color-light);
		stroke: var(--color-light);
		stroke-width: 5;
		stroke-linejoin: round;
		pointer-events: none;
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: fig-in 560ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: var(--d);
		transition: opacity 360ms var(--ease);
	}

	.halo--off {
		opacity: 0.4;
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

	.pf-stage .fig--obstrucao,
	.fig--obstrucao {
		fill: var(--color-light);
		stroke: var(--vote-sim);
		stroke-width: 2.6;
		paint-order: normal;
	}

	.pf-stage .fig--ausentes,
	.fig--ausentes {
		fill: var(--color-light);
		stroke: var(--vote-ausentes-traco);
		stroke-width: 2.6;
		paint-order: normal;
	}

	.fig:hover,
	.fig--on {
		transform: scale(1.35);
		fill: var(--accent-amber);
	}

	.fig--off {
		opacity: 0.1;
	}

	.pf-tip {
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

	.pf-tip::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 100%;
		transform: translateX(-50%);
		border: 8px solid transparent;
		border-top-color: var(--color-dark);
	}

	.pf-tip img {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		object-fit: cover;
		background: color-mix(in srgb, var(--color-light) 20%, transparent);
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
		color: var(--vote-nao);
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
		height: 24px;
		overflow: visible;
	}

	.legend-item .fig {
		animation: none;
	}

	.legend-item b {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.legend-item--off {
		opacity: 0.35;
	}
</style>
