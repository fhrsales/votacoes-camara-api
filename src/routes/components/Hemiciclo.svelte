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
	/** Decorative version for the hero: no score, legend or interaction. */
	export let mini = false;

	const dispatch = createEventDispatcher();
	const CADEIRAS = 513;
	const FILEIRAS = 11;
	const R0 = 0.47;
	const ESCALA = 420;

	let hover = null;
	let tip = { x: 0, y: 0 };
	let wrapEl;

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
				const ang = k === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (k - 1);
				pontos.push({ ang, r, fileira, x: r * Math.cos(ang), y: -r * Math.sin(ang) });
			}
		});
		return pontos.sort((a, b) => b.ang - a.ang || a.r - b.r);
	}

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

	$: pontos = geometria(ordenados.length);
	$: cadeiras = ordenados.map((v, i) => ({ ...pontos[i], voto: v }));
	$: c = contar(ordenados);
	$: maioria = Math.floor(CADEIRAS / 2) + 1;
	$: resultado = c.Sim >= c.Não ? 'Sim' : 'Não';

	function apagada(v, filtroVoto, filtroEstado, filtroPartido, filtroNome) {
		if (filtroVoto && v.tipoVoto !== filtroVoto) return true;
		if (filtroEstado && v.deputado_?.siglaUf !== filtroEstado) return true;
		if (filtroPartido && v.deputado_?.siglaPartido !== filtroPartido) return true;
		if (filtroNome && v.deputado_?.nome !== filtroNome) return true;
		return false;
	}

	function mostrar(event, cadeira) {
		hover = cadeira.voto;
		mover(event);
	}

	function mover(event) {
		if (!wrapEl) return;
		const rect = wrapEl.getBoundingClientRect();
		const x = (event.clientX ?? rect.left + rect.width / 2) - rect.left;
		const y = (event.clientY ?? rect.top) - rect.top;
		tip = { x: Math.min(Math.max(x, 110), rect.width - 110), y };
	}
</script>

<figure class="hemi" class:hemi--mini={mini} aria-hidden={mini}>
	<div class="hemi-stage" bind:this={wrapEl} on:mouseleave={() => (hover = null)}>
		{#key chave}
			<svg
				viewBox={`${-ESCALA * 1.04} ${-ESCALA * 1.06} ${ESCALA * 2.08} ${ESCALA * 1.1}`}
				role="img"
				aria-label={`Plenário: ${c.Sim} sim, ${c.Não} não, ${c.Abstenção} abstenções, ${c.Obstrução} obstruções, ${c.Ausentes} ausentes`}
			>
				<line class="hemi-axis" x1="0" y1={-ESCALA * 1.05} x2="0" y2={-ESCALA * R0 * 0.94} />
				{#each cadeiras as s, i (i)}
					<circle
						class="seat"
						class:seat--off={apagada(s.voto, filtroVoto, filtroEstado, filtroPartido, filtroNome)}
						class:seat--on={hover === s.voto}
						class:seat--anel={s.voto.tipoVoto === 'Obstrução'}
						class:seat--vazio={s.voto.tipoVoto === 'Ausentes'}
						cx={s.x * ESCALA}
						cy={s.y * ESCALA}
						r={ESCALA * 0.021}
						style={`fill:${COR[s.voto.tipoVoto]};--d:${Math.round(((Math.PI - s.ang) / Math.PI) * 700 + s.fileira * 18)}ms`}
						on:mouseenter={(e) => mostrar(e, s)}
						on:mousemove={mover}
						on:click={() => dispatch('deputado', s.voto.deputado_?.nome)}
						on:keydown={(e) => e.key === 'Enter' && dispatch('deputado', s.voto.deputado_?.nome)}
						role="button"
						tabindex="-1"
						aria-label={`${s.voto.deputado_?.nome}: ${s.voto.tipoVoto}`}
					/>
				{/each}
			</svg>
		{/key}

		{#if !mini}
		<div class="hemi-center">
			<div class="hemi-score">
				<span class="score score--sim"><b use:countUp={c.Sim}>0</b><small>sim</small></span>
				<span class="score-x">×</span>
				<span class="score score--nao"><b use:countUp={c.Não}>0</b><small>não</small></span>
			</div>
			<p class="hemi-verdict">
				{#if c.Sim + c.Não > 0}
					Venceu o <strong style={`color:${COR[resultado]}`}>{resultado.toLowerCase()}</strong>
					por {Math.abs(c.Sim - c.Não).toLocaleString('pt-BR')} votos
				{/if}
			</p>
		</div>
		<span class="hemi-maioria">{maioria} · maioria absoluta</span>
		{/if}

		{#if hover && !mini}
			<div class="hemi-tip" style={`left:${tip.x}px;top:${tip.y}px`}>
				<img src={hover.deputado_?.urlFoto} alt="" width="52" height="52" loading="lazy" />
				<div>
					<strong>{hover.deputado_?.nome}</strong>
					<span>{hover.deputado_?.siglaPartido} · {hover.deputado_?.siglaUf}</span>
					<em style={`--c:${COR[hover.tipoVoto]}`}>{hover.tipoVoto}</em>
				</div>
			</div>
		{/if}
	</div>

	{#if !mini}
	<figcaption class="hemi-legend">
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
	</figcaption>
	{/if}
</figure>

<style>
	.hemi {
		margin: 0;
	}

	.hemi-stage {
		position: relative;
	}

	.hemi--mini {
		pointer-events: none;
	}

	.hemi--mini .hemi-axis {
		opacity: 0.2;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.hemi-axis {
		stroke: var(--color-dark);
		stroke-width: 1.5;
		stroke-dasharray: 3 5;
		opacity: 0.35;
	}

	.seat {
		transform-box: fill-box;
		transform-origin: center;
		cursor: pointer;
		animation: seat-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: var(--d);
		transition: opacity 360ms var(--ease), transform 180ms var(--ease), fill 360ms var(--ease);
	}

	.seat:hover,
	.seat--on {
		transform: scale(1.7);
		fill: var(--accent-amber) !important;
	}

	.seat--anel {
		fill: var(--color-light) !important;
		stroke: var(--vote-sim);
		stroke-width: 3;
	}

	.seat--vazio {
		fill: var(--color-light) !important;
		stroke: var(--vote-ausentes-traco);
		stroke-width: 3.2;
	}

	.seat--off {
		opacity: 0.12;
	}

	@keyframes seat-in {
		from {
			opacity: 0;
			transform: scale(0) translateY(14px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.hemi-center {
		position: absolute;
		left: 50%;
		bottom: 2%;
		transform: translateX(-50%);
		text-align: center;
		pointer-events: none;
		width: 52%;
	}

	.hemi-score {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: calc(var(--grid) * 1.5);
		font-family: var(--font-display);
		line-height: 1;
	}

	.score {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
	}

	.score b {
		font-weight: 500;
		font-size: clamp(calc(var(--grid) * 4), 6vw, calc(var(--grid) * 6.5));
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}

	.score small {
		font-family: var(--font-primary);
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		margin-top: calc(var(--grid) * 0.6);
	}

	.score--sim {
		color: var(--vote-sim);
	}

	.score--nao {
		color: var(--vote-nao);
	}

	.score-x {
		font-size: calc(var(--grid) * 3);
		opacity: 0.35;
	}

	.hemi-verdict {
		margin: calc(var(--grid) * 1) 0 0;
		font-size: calc(var(--grid) * 1.9);
		color: var(--color-text-muted);
	}

	.hemi-maioria {
		position: absolute;
		top: -2px;
		left: 50%;
		transform: translate(8px, 0);
		font-size: var(--t-small);
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.hemi-tip {
		position: absolute;
		transform: translate(-50%, calc(-100% - 18px));
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

	.hemi-tip::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 100%;
		transform: translateX(-50%);
		border: 8px solid transparent;
		border-top-color: var(--color-dark);
	}

	.hemi-tip img {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		object-fit: cover;
		background: color-mix(in srgb, var(--color-light) 20%, transparent);
	}

	.hemi-tip div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: var(--t-small);
		line-height: 1.3;
	}

	.hemi-tip strong {
		font-size: var(--t-caption);
	}

	.hemi-tip span {
		opacity: 0.7;
	}

	.hemi-tip em {
		font-style: normal;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.hemi-tip em::before {
		content: '';
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--c);
	}

	@keyframes tip-in {
		from {
			opacity: 0;
			transform: translate(-50%, calc(-100% - 10px));
		}
	}

	.hemi-legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
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

	@media (max-width: 600px) {
		.hemi-center {
			position: static;
			transform: none;
			width: 100%;
			margin-top: calc(var(--grid) * 2);
		}

		.hemi-maioria {
			display: none;
		}
	}
</style>
