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
	const FILEIRAS = 11;
	const R0 = 0.42;
	// Drawing space: the chamber is a half disc seen from the front and slightly above
	const LARGURA = 1000;
	const CENTRO_X = 500;
	const BASE_Y = 520;
	const RAIO_X = 468;
	const PROFUNDIDADE = 300;
	const FIG_ALTURA = 48;

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
				// Odd rows sit half a seat over, like an audience, instead of lining up in rays
				const t = k === 1 ? 0.5 : fileira % 2 ? (j + 0.5) / k : j / (k - 1);
				const ang = Math.PI - Math.PI * t;
				pontos.push({ ang, r, fileira });
			}
		});
		// Order by angle so votes fill the chamber from left to right
		return pontos.sort((a, b) => b.ang - a.ang || a.r - b.r);
	}

	// Seen from the front: depth pushes a seat up and makes it smaller
	function projetar(p) {
		const x = Math.cos(p.ang) * p.r;
		const prof = Math.sin(p.ang) * p.r; // 0 at the front corners, 1 at the back centre
		const escala = 1 / (1 + 0.5 * prof);
		return {
			x: CENTRO_X + x * RAIO_X * (0.86 + 0.14 * escala),
			y: BASE_Y - prof * PROFUNDIDADE * escala,
			escala,
			prof
		};
	}

	$: pontos = geometria(ordenados.length);
	$: figuras = ordenados
		.map((voto, i) => {
			const p = pontos[i];
			const q = projetar(p);
			return {
				voto,
				...q,
				mulher: mulheres.has(voto.deputado_?.id),
				atraso: Math.round(((Math.PI - p.ang) / Math.PI) * 700 + p.fileira * 20)
			};
		})
		// Paint from the back to the front so nearer people overlap those behind
		.sort((a, b) => b.prof - a.prof);
	$: c = contar(ordenados);
	$: resultado = c.Sim >= c.Não ? 'Sim' : 'Não';
	$: topo = Math.min(...figuras.map((f) => f.y - FIG_ALTURA * 0.95 * f.escala), BASE_Y) - 8;

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
				viewBox={`0 ${topo} ${LARGURA} ${BASE_Y + 6 - topo}`}
				role="img"
				aria-label={`Plenário: ${c.Sim} sim, ${c.Não} não, ${c.Abstenção} abstenções, ${c.Obstrução} obstruções, ${c.Ausentes} ausentes`}
			>
				<defs>
					<!-- Full-body silhouettes, 20 x 48, feet at the bottom centre -->
					<g id="pf-homem">
						<circle cx="10" cy="5" r="4.3" />
						<path
							d="M4.5 11.6Q4.5 10.4 6 10.4H14Q15.5 10.4 15.5 11.6L16.6 25Q16.7 26.5 15.4 26.5Q14.3 26.5 14.2 25.3L13.4 16.8V45.6Q13.4 47 11.9 47Q10.4 47 10.4 45.6V30.5H9.6V45.6Q9.6 47 8.1 47Q6.6 47 6.6 45.6V16.8L5.8 25.3Q5.7 26.5 4.6 26.5Q3.3 26.5 3.4 25Z"
						/>
					</g>
					<g id="pf-mulher">
						<path d="M5.4 6Q5.2 0.6 10 0.6Q14.8 0.6 14.6 6L15 11.4Q12.6 12.4 10 12.4Q7.4 12.4 5 11.4Z" />
						<circle cx="10" cy="5.3" r="3.9" />
						<path
							d="M6.6 10.8H13.4Q14.6 10.8 14.9 12L16.6 24.4Q16.8 25.8 15.6 25.9Q14.6 26 14.4 24.8L13.7 19L16.2 33.2H3.8L6.3 19L5.6 24.8Q5.4 26 4.4 25.9Q3.2 25.8 3.4 24.4L5.1 12Q5.4 10.8 6.6 10.8Z"
						/>
						<path d="M7.4 33H9.4V45.6Q9.4 47 8.4 47Q7.4 47 7.4 45.6ZM10.6 33H12.6V45.6Q12.6 47 11.6 47Q10.6 47 10.6 45.6Z" />
					</g>
				</defs>

				{#each figuras as f, i (i)}
					<g transform={`translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) scale(${(f.escala * 0.95).toFixed(3)})`}>
						<use
							href={f.mulher ? '#pf-mulher' : '#pf-homem'}
							x="-10"
							y="-47"
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
				<svg viewBox="0 0 20 48" aria-hidden="true">
					<use
						href="#pf-homem"
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

	.pf-stage .fig {
		stroke: var(--color-light);
		stroke-width: 1.3;
		paint-order: stroke;
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
		stroke-width: 1.6;
		paint-order: normal;
	}

	.pf-stage .fig--ausentes,
	.fig--ausentes {
		fill: var(--color-light);
		stroke: var(--vote-ausentes-traco);
		stroke-width: 1.6;
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
