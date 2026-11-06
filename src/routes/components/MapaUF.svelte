<script>
	import { createEventDispatcher } from 'svelte';
	import { agruparPor } from '$lib/votos.js';
	import { manterNaTela } from '$lib/motion.js';

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
		const forca = Math.round(8 + share * 92);
		const bg = `color-mix(in srgb, var(--vote-sim) ${forca}%, var(--color-light))`;
		return { d, share, bg, ink: forca > 52 ? '#fff' : 'var(--color-dark)' };
	}

	$: tiles = Object.entries(GRADE).map(([uf, [col, row]]) => ({ uf, col, row, ...tile(uf, porUf) }));
</script>

{#key chave}
	<div class="mapa" role="group" aria-label="Votos por estado">
		{#each tiles as t, i (t.uf)}
			<button
				type="button"
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
				<span class="uf-pct">
					{#if t.share === null}–{:else}{Math.round(t.share * 100)}%<small>sim</small>{/if}
				</span>
				{#if t.d}
					<span class="uf-tip" use:manterNaTela>
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
		container-type: inline-size;
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
		box-shadow: var(--shadow-2), 0 0 0 3px var(--accent-amber);
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
		margin-left: var(--desvio, 0px);
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
		left: calc(50% - var(--desvio, 0px));
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

		.uf-pct small {
			display: none;
		}
	}
	/* Narrow tiles: drop the small "sim" and shrink the number so nothing is cut */
	@container (max-width: 470px) {
		.uf-pct {
			font-size: clamp(11px, 4.4cqi, 22px);
		}

		.uf-pct small {
			display: none;
		}

		.uf-sigla {
			font-size: clamp(10px, 3cqi, 15px);
		}
	}

	.uf-pct,
	.uf-sigla {
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
	}
</style>
