<script>
	import { createEventDispatcher } from 'svelte';
	import { agruparPor } from '$lib/votos.js';

	export let votos = [];
	export let chave = '';
	export let selecionado = '';

	const dispatch = createEventDispatcher();
	let hover = '';

	$: partidos = agruparPor(votos, (v) => v?.deputado_?.siglaPartido)
		.map((p) => {
			const votaram = p.Sim + p.Não;
			return { ...p, saldo: votaram ? (p.Sim - p.Não) / votaram : 0 };
		})
		.sort((a, b) => b.saldo - a.saldo || b.total - a.total);
	$: maxLado = Math.max(1, ...partidos.map((p) => Math.max(p.Sim + p.Abstenção, p.Não + p.Obstrução)));
	$: w = (n) => `${(n / maxLado) * 100}%`;
</script>

<div class="div-head" aria-hidden="true">
	<span class="div-head-sim">← sim</span>
	<span class="div-head-nao">não →</span>
</div>

{#key chave}
	<ol class="div-list" style={`--n:${partidos.length}`}>
		{#each partidos as p, i (p.chave)}
			<li
				class="div-row"
				class:div-row--off={(selecionado && selecionado !== p.chave) || (hover && hover !== p.chave)}
				class:div-row--sel={selecionado === p.chave}
				style={`--i:${i}`}
			>
				<button
					type="button"
					on:mouseenter={() => (hover = p.chave)}
					on:mouseleave={() => (hover = '')}
					on:focus={() => (hover = p.chave)}
					on:blur={() => (hover = '')}
					on:click={() => dispatch('partido', selecionado === p.chave ? '' : p.chave)}
					aria-label={`${p.chave}: ${p.Sim} sim, ${p.Não} não, ${p.Abstenção} abstenções, ${p.Obstrução} obstruções, ${p.Ausentes} ausentes`}
				>
					<span class="div-name">{p.chave}</span>
					<span class="div-track">
						<span class="div-side div-side--sim">
							<span class="pill" style={`width:${w(p.Sim + p.Abstenção)}`}>
								<i class="seg" style={`flex:${p.Sim};background:var(--vote-sim)`} />
								<i class="seg" style={`flex:${p.Abstenção};background:var(--vote-abstencao)`} />
							</span>
						</span>
						<span class="div-side div-side--nao">
							<span class="pill" style={`width:${w(p.Não + p.Obstrução)}`}>
								<i class="seg" style={`flex:${p.Não};background:var(--vote-nao)`} />
								<i class="seg" style={`flex:${p.Obstrução};background:var(--vote-obstrucao)`} />
							</span>
						</span>
					</span>
					<span class="div-n">
						<b>{p.Sim}</b><span>·</span><b class="n-nao">{p.Não}</b>
						{#if p.Ausentes}<small>{p.Ausentes} aus.</small>{/if}
					</span>
				</button>
			</li>
		{/each}
	</ol>
{/key}

<style>
	.div-head {
		display: grid;
		grid-template-columns: 9ch 1fr 1fr 11ch;
		font-size: var(--t-small);
		font-weight: 600;
		color: var(--color-text-muted);
		margin-bottom: calc(var(--grid) * 1);
	}

	.div-head-sim {
		grid-column: 2;
		text-align: right;
		padding-right: calc(var(--grid) * 1);
		color: var(--vote-sim);
	}

	.div-head-nao {
		grid-column: 3;
		padding-left: calc(var(--grid) * 1);
		color: var(--vote-nao-texto);
	}

	.div-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.div-row {
		border-top: 1px solid var(--color-rule);
		transition: opacity 360ms var(--ease);
	}

	.div-row--sel {
		background: color-mix(in srgb, var(--accent-amber) 16%, transparent);
		box-shadow: inset 3px 0 0 var(--accent-amber);
	}

	.div-row--sel button {
		padding-left: 8px;
	}

	.div-row--off {
		opacity: 0.3;
	}

	.div-row button {
		display: grid;
		grid-template-columns: 9ch 1fr 11ch;
		align-items: center;
		width: 100%;
		padding: calc(var(--grid) * 0.55) 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--color-dark);
		cursor: pointer;
		text-align: left;
	}

	.div-name {
		font-size: var(--t-small);
		font-weight: 600;
		transition: color 180ms var(--ease), transform 180ms var(--ease);
	}

	.div-row button:hover .div-name,
	.div-row--sel .div-name {
		color: var(--accent-amber-ink);
		transform: translateX(4px);
	}

	.div-track {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 1fr;
		height: calc(var(--grid) * 1.8);
	}

	.div-track::after {
		content: '';
		position: absolute;
		left: 50%;
		top: -4px;
		bottom: -4px;
		width: 1px;
		background: var(--color-dark);
	}

	.div-side {
		display: flex;
		height: 100%;
		animation: grow 600ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: calc(var(--i) * 28ms);
	}

	.pill {
		display: flex;
		gap: 2px;
		height: 100%;
		overflow: hidden;
		border-radius: 0 999px 999px 0;
		transition: width 360ms var(--ease);
	}

	/* Sim grows leftwards from the centre line, não rightwards */
	.div-side--sim .pill {
		flex-direction: row-reverse;
		border-radius: 999px 0 0 999px;
	}

	.div-side--sim {
		flex-direction: row-reverse;
		transform-origin: right center;
	}

	.div-side--nao {
		transform-origin: left center;
	}

	.seg {
		display: block;
		height: 100%;
		min-width: 0;
	}

	@keyframes grow {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}

	.div-n {
		display: inline-flex;
		align-items: baseline;
		justify-content: flex-end;
		gap: 4px;
		font-size: var(--t-small);
		font-variant-numeric: tabular-nums;
		color: var(--vote-sim);
	}

	.div-n span {
		color: var(--color-text-muted);
	}

	.div-n .n-nao {
		color: var(--vote-nao-texto);
	}

	.div-n small {
		color: var(--color-text-muted);
		font-size: calc(var(--grid) * 1.4);
		margin-left: 4px;
	}

	@media (max-width: 600px) {
		.div-row button,
		.div-head {
			grid-template-columns: 7ch 1fr 7ch;
		}

		.div-head {
			grid-template-columns: 7ch 1fr 1fr 7ch;
		}

		.div-n small {
			display: none;
		}

		/* Every party fits on one screen below the sticky bar: the row height is the space
		   left divided by the number of parties */
		.div-row button {
			height: max(15px, calc((100svh - var(--barra-h, 160px) - 56px) / var(--n, 20)));
			padding: 0;
			font-size: var(--t-mini);
		}

		.div-name,
		.div-n {
			font-size: var(--t-mini);
			line-height: 1;
		}

		.div-track {
			height: min(12px, 70%);
		}

		.div-track::after {
			top: -2px;
			bottom: -2px;
		}

		.div-head {
			margin-bottom: 4px;
		}
	}
</style>
