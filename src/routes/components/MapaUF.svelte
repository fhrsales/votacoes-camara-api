<script>
	import { createEventDispatcher } from 'svelte';
	import { agruparPor } from '$lib/votos.js';

	export let votos = [];
	export let chave = '';
	export let selecionado = '';

	const dispatch = createEventDispatcher();

	// Tile cartogram of Brazil: [column, row]
	const GRADE = {
		RR: [1, 0], AP: [2, 0],
		AC: [0, 1], AM: [1, 1], PA: [2, 1], MA: [3, 1], CE: [4, 1], RN: [5, 1],
		RO: [1, 2], TO: [2, 2], PI: [3, 2], PE: [4, 2], PB: [5, 2],
		MT: [1, 3], GO: [2, 3], BA: [3, 3], SE: [4, 3], AL: [5, 3],
		MS: [1, 4], DF: [2, 4], MG: [3, 4], ES: [4, 4],
		PR: [2, 5], SP: [3, 5], RJ: [4, 5],
		SC: [2, 6],
		RS: [2, 7]
	};

	$: porUf = new Map(agruparPor(votos, (v) => v?.deputado_?.siglaUf).map((u) => [u.chave, u]));

	function tile(uf, porUf) {
		const d = porUf.get(uf);
		const votaram = d ? d.Sim + d.Não : 0;
		if (!votaram) return { d, share: null, bg: 'var(--color-track)', ink: 'var(--color-dark)' };
		const share = d.Sim / votaram;
		const forca = Math.round(Math.abs(share - 0.5) * 2 * 100);
		const base = share >= 0.5 ? 'var(--vote-sim)' : 'var(--vote-nao)';
		const bg = `color-mix(in srgb, ${base} ${Math.max(14, forca)}%, var(--color-light))`;
		return { d, share, bg, ink: forca > 55 ? '#fff' : 'var(--color-dark)' };
	}

	$: tiles = Object.entries(GRADE).map(([uf, [col, row]]) => ({ uf, col, row, ...tile(uf, porUf) }));
</script>

{#key chave}
	<div class="mapa" role="list">
		{#each tiles as t, i (t.uf)}
			<button
				type="button"
				role="listitem"
				class="uf"
				class:uf--off={selecionado && selecionado !== t.uf}
				class:uf--sel={selecionado === t.uf}
				style={`grid-column:${t.col + 1};grid-row:${t.row + 1};--bg:${t.bg};--ink:${t.ink};--i:${t.row * 6 + t.col}`}
				on:click={() => dispatch('estado', selecionado === t.uf ? '' : t.uf)}
				aria-label={t.d
					? `${t.uf}: ${t.d.Sim} sim, ${t.d.Não} não, ${t.d.Ausentes} ausentes`
					: `${t.uf}: sem votos`}
			>
				<span class="uf-sigla">{t.uf}</span>
				<span class="uf-pct">{t.share === null ? '–' : `${Math.round(t.share * 100)}%`}</span>
				{#if t.d}
					<span class="uf-tip">{t.d.Sim} sim · {t.d.Não} não · {t.d.Ausentes} aus.</span>
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
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		grid-template-rows: repeat(8, auto);
		gap: 5px;
		max-width: 470px;
		margin: 0 auto;
	}

	.uf {
		position: relative;
		aspect-ratio: 1;
		border: 0;
		border-radius: 6px;
		background: var(--bg);
		color: var(--ink);
		font: inherit;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		align-items: flex-start;
		padding: 7px 8px;
		cursor: pointer;
		animation: tile-in 600ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: calc(var(--i) * 14ms);
		transition: transform 180ms var(--ease), box-shadow 180ms var(--ease),
			opacity 360ms var(--ease), background-color 360ms var(--ease);
	}

	.uf:hover,
	.uf--sel {
		transform: translateY(-3px) scale(1.04);
		box-shadow: var(--shadow-2);
		z-index: 2;
	}

	.uf--sel {
		box-shadow: var(--shadow-2), inset 0 -3px 0 var(--color-dark);
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

	.uf-sigla {
		font-size: var(--t-small);
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.uf-pct {
		font-family: var(--font-display);
		font-size: calc(var(--grid) * 2.4);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.uf-tip {
		position: absolute;
		left: 50%;
		bottom: calc(100% + 12px);
		transform: translate(-50%, 4px);
		padding: calc(var(--grid) * 1) calc(var(--grid) * 1.6);
		border-radius: 12px;
		background: var(--color-dark);
		color: var(--color-light);
		font-size: var(--t-small);
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 180ms var(--ease), transform 180ms var(--ease);
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
		background: linear-gradient(90deg, var(--vote-nao), var(--color-light), var(--vote-sim));
		box-shadow: inset 0 0 0 1px var(--color-rule);
	}

	@media (hover: none) {
		.uf-tip {
			display: none;
		}
	}

	@media (max-width: 600px) {
		.uf {
			padding: 4px 5px;
			border-radius: 4px;
		}

		.uf-sigla {
			font-size: calc(var(--grid) * 1.35);
		}

		.uf-pct {
			font-size: calc(var(--grid) * 1.8);
		}
	}
</style>
