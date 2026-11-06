<script>
	import { createEventDispatcher } from 'svelte';
	import { agruparPor } from '$lib/votos.js';

	export let votos = [];
	export let chave = '';
	export let selecionado = '';

	const dispatch = createEventDispatcher();

	// Hexagon cartogram of Brazil, pointy-top, odd rows shifted half a cell east: [column, row].
	// One hexagon per state, placed so the wide North, the north-east bulge and the narrow
	// South still read as the country.
	const GRADE = {
		RR: [2, 0], AP: [3, 0],
		AM: [1, 1], PA: [2, 1], MA: [3, 1], CE: [4, 1], RN: [5, 1],
		AC: [0, 2], RO: [1, 2], MT: [2, 2], TO: [3, 2], PI: [4, 2], PE: [5, 2], PB: [6, 2],
		MS: [1, 3], GO: [2, 3], DF: [3, 3], BA: [4, 3], SE: [5, 3], AL: [6, 3],
		SP: [2, 4], MG: [3, 4], ES: [4, 4],
		PR: [1, 5], RJ: [3, 5],
		SC: [1, 6],
		RS: [0, 7]
	};
	const COLUNAS = 7.5;
	const LINHAS = 8;
	const ALTURA_HEX = 2 / Math.sqrt(3); // height of a pointy-top hexagon of width 1
	const ALTURA_TOTAL = (LINHAS - 1) * 0.75 * ALTURA_HEX + ALTURA_HEX;

	$: porUf = new Map(agruparPor(votos, (v) => v?.deputado_?.siglaUf).map((u) => [u.chave, u]));

	function tile(uf, porUf) {
		const d = porUf.get(uf);
		const votaram = d ? d.Sim + d.Não : 0;
		if (!votaram) return { d, share: null, bg: 'var(--color-track)', ink: 'var(--color-dark)' };
		const share = d.Sim / votaram;
		const forca = Math.round(8 + share * 92);
		const bg = `color-mix(in srgb, var(--vote-sim) ${forca}%, var(--color-light))`;
		return { d, share, bg, ink: forca > 52 ? '#fff' : 'var(--color-dark)' };
	}

	$: tiles = Object.entries(GRADE).map(([uf, [col, row]]) => ({
		uf,
		col,
		row,
		x: ((col + (row % 2 ? 0.5 : 0)) / COLUNAS) * 100,
		y: ((row * 0.75 * ALTURA_HEX) / ALTURA_TOTAL) * 100,
		...tile(uf, porUf)
	}));
</script>

{#key chave}
	<div class="mapa" role="list" style={`aspect-ratio:${COLUNAS} / ${ALTURA_TOTAL}`}>
		{#each tiles as t, i (t.uf)}
			<button
				type="button"
				role="listitem"
				class="uf"
				class:uf--off={selecionado && selecionado !== t.uf}
				class:uf--sel={selecionado === t.uf}
				style={`left:${t.x}%;top:${t.y}%;width:${100 / COLUNAS}%;height:${(ALTURA_HEX / ALTURA_TOTAL) * 100}%;--bg:${t.bg};--ink:${t.ink};--i:${t.row * 6 + t.col}`}
				on:click={() => dispatch('estado', selecionado === t.uf ? '' : t.uf)}
				aria-label={t.d
					? `${t.uf}: ${t.d.Sim} sim, ${t.d.Não} não, ${t.d.Ausentes} ausentes`
					: `${t.uf}: sem votos`}
			>
				<span class="hex" aria-hidden="true" />
				<span class="uf-sigla">{t.uf}</span>
				<span class="uf-pct">
					{#if t.share === null}–{:else}{Math.round(t.share * 100)}%<small>sim</small>{/if}
				</span>
				{#if t.d}
					<span class="uf-tip">
						<span class="tip-label">{t.uf} · {t.d.total} cadeiras</span>
						<span class="tip-big">
							{t.share === null ? '–' : `${Math.round(t.share * 100)}%`}<small>de sim</small>
						</span>
						<span class="tip-barra">
							<i style={`flex:${t.d.Sim};background:var(--vote-sim)`} />
							<i style={`flex:${t.d.Não};background:var(--vote-nao)`} />
							<i style={`flex:${t.d.Abstenção + t.d.Obstrução};background:var(--vote-abstencao)`} />
							<i style={`flex:${t.d.Ausentes};background:var(--vote-ausentes)`} />
						</span>
						<span class="tip-linhas">
							<span><i style="background:var(--vote-sim)" />{t.d.Sim} sim</span>
							<span><i style="background:var(--vote-nao)" />{t.d.Não} não</span>
							{#if t.d.Abstenção + t.d.Obstrução}
								<span><i style="background:var(--vote-abstencao)" />{t.d.Abstenção + t.d.Obstrução} outros</span>
							{/if}
							<span><i style="background:var(--vote-ausentes)" />{t.d.Ausentes} ausentes</span>
						</span>
					</span>
				{/if}
			</button>
		{/each}
	</div>
{/key}

<div class="mapa-legenda">
	<span>100% não</span>
	<i />
	<span>100% sim</span>
</div>

<style>
	.mapa {
		position: relative;
		width: 100%;
		max-width: 520px;
		margin: 0 auto;
	}

	.uf {
		position: absolute;
		border: 0;
		padding: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		cursor: pointer;
		animation: tile-in 600ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: calc(var(--i) * 14ms);
		transition: transform 180ms var(--ease), opacity 360ms var(--ease);
	}

	.hex {
		position: absolute;
		inset: 2.5%;
		background: var(--bg);
		clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
		transition: background-color 360ms var(--ease), filter 180ms var(--ease);
		z-index: -1;
	}

	.uf:hover,
	.uf--sel {
		transform: translateY(-3px) scale(1.06);
		z-index: 3;
	}

	.uf:hover .hex {
		filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.25));
	}

	.uf--sel .hex {
		inset: 0;
		box-shadow: none;
		filter: drop-shadow(0 0 0 var(--color-dark));
	}

	.uf--sel::before {
		content: '';
		position: absolute;
		inset: -2%;
		background: var(--accent-amber);
		clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
		z-index: -2;
	}

	.uf--off {
		opacity: 0.3;
	}

	@keyframes tile-in {
		from {
			opacity: 0;
			transform: scale(0.6);
		}
	}

	.uf {
		isolation: isolate;
	}

	.uf-sigla {
		font-size: calc(var(--grid) * 1.4);
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.uf-pct {
		font-family: var(--font-display);
		font-size: calc(var(--grid) * 2);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.uf-pct small {
		font-family: var(--font-primary);
		font-size: 0.5em;
		font-weight: 600;
		margin-left: 3px;
		opacity: 0.75;
	}

	.uf-tip {
		position: absolute;
		left: 50%;
		bottom: calc(100% + 14px);
		transform: translate(-50%, 4px);
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 220px;
		padding: calc(var(--grid) * 1.6) calc(var(--grid) * 1.8);
		border-radius: 14px;
		background: var(--color-dark);
		color: var(--color-light);
		box-shadow: var(--shadow-2);
		text-align: left;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		z-index: 10;
		transition: opacity 180ms var(--ease), transform 180ms var(--ease);
	}

	.tip-label {
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.tip-big {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-family: var(--font-display);
		font-size: calc(var(--grid) * 4);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.tip-big small {
		font-family: var(--font-primary);
		font-size: var(--t-small);
		opacity: 0.7;
	}

	.tip-barra {
		display: flex;
		gap: 2px;
		height: 8px;
		border-radius: 999px;
		overflow: hidden;
	}

	.tip-barra i {
		display: block;
		min-width: 0;
	}

	.tip-linhas {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px 16px;
		font-size: calc(var(--grid) * 1.6);
	}

	.tip-linhas span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.tip-linhas i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.uf-tip::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 100%;
		transform: translateX(-50%);
		border: 7px solid transparent;
		border-top-color: var(--color-dark);
	}

	.uf:hover .uf-tip {
		opacity: 1;
		transform: translate(-50%, 0);
	}

	.mapa-legenda {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: calc(var(--grid) * 1);
		margin-top: calc(var(--grid) * 2.5);
		font-size: var(--t-small);
		color: var(--color-text-muted);
	}

	.mapa-legenda i {
		width: 160px;
		height: 8px;
		border-radius: 999px;
		background: linear-gradient(90deg, color-mix(in srgb, var(--vote-sim) 8%, var(--color-light)), var(--vote-sim));
		box-shadow: inset 0 0 0 1px var(--color-rule);
	}

	@media (hover: none) {
		.uf-tip {
			display: none;
		}
	}

	@media (max-width: 600px) {
		.uf-sigla {
			font-size: calc(var(--grid) * 1.15);
		}

		.uf-pct {
			font-size: calc(var(--grid) * 1.45);
		}

		.uf-pct small {
			display: none;
		}
	}
</style>
