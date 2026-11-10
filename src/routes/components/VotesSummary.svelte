<script>
	import { createEventDispatcher } from 'svelte';
	import { manterNaTela } from '$lib/motion.js';

	export let votacaoId = '';
	export let resumoTexto = '';
	export let resumoVotos = {};
	export let filtroVoto = '';
	export let fimTexto = '';
	export let fimTextoCurto = '';
	export let temMes = false;

	const dispatch = createEventDispatcher();
	const resumoVazio = {
		sim: 0,
		nao: 0,
		abstencao: 0,
		obstrucao: 0,
		ausentes: 0,
		total: 0,
		totalGeral: 0
	};
	let resumoSafe = { ...resumoVazio };
	let tooltipTexto = '';
	let tooltipValor = '';
	let tooltipCor = '';
	let tooltipPos = { x: 0, y: 0 };
	let hoverTipo = '';
	let mostrarNota = false;
	$: temFim = Boolean(fimTexto);
	$: temFimCurto = Boolean(fimTextoCurto);
	$: temResumoTexto = Boolean(resumoTexto);
	$: temResultado = resumoSafe.totalGeral > 0 || resumoSafe.total > 0;

	const cores = {
		Sim: 'var(--color-success)',
		Não: 'var(--color-danger)',
		Abstenção: 'var(--color-warning)',
		Obstrução: 'var(--color-info)',
		Ausentes: 'var(--color-neutral)'
	};

	let stackedEl;

	// Position relative to the whole bar (the tooltip lives in .stacked), not to the segment.
	function posicionar(event) {
		if (!stackedEl) return;
		const caixa = stackedEl.getBoundingClientRect();
		const alvo = event?.currentTarget?.getBoundingClientRect?.();
		const temPonteiro = typeof event?.clientX === 'number' && event.clientX > 0;
		const x = temPonteiro ? event.clientX - caixa.left : alvo ? alvo.left + alvo.width / 2 - caixa.left : 0;
		const margem = 70;
		tooltipPos = { x: Math.min(Math.max(x, margem), caixa.width - margem), y: -8 };
	}

	function abrirTooltip(tipo, valor, event) {
		tooltipTexto = tipo;
		tooltipValor = String(valor);
		tooltipCor = cores[tipo] || 'var(--color-text)';
		hoverTipo = tipo;
		posicionar(event);
	}

	function fecharTooltip() {
		tooltipTexto = '';
		tooltipValor = '';
		tooltipCor = '';
		hoverTipo = '';
	}

	function moverTooltip(event) {
		posicionar(event);
	}

	function labelOculto(valor, totalBase) {
		if (!totalBase) return true;
		return (valor / totalBase) * 100 < 8;
	}

	function solicitarFiltro(tipo) {
		dispatch('filterChange', { tipo });
	}

	function calcularLarguras(total, resumo) {
		if (!total) {
			return {
				sim: 0,
				abstencao: 0,
				obstrucao: 0,
				ausentes: 0,
				nao: 0
			};
		}
		const bruto = {
			sim: (resumo.sim / total) * 100,
			abstencao: (resumo.abstencao / total) * 100,
			obstrucao: (resumo.obstrucao / total) * 100,
			ausentes: (resumo.ausentes / total) * 100,
			nao: (resumo.nao / total) * 100
		};
		const arred = {
			sim: Math.floor(bruto.sim * 100) / 100,
			abstencao: Math.floor(bruto.abstencao * 100) / 100,
			obstrucao: Math.floor(bruto.obstrucao * 100) / 100,
			ausentes: Math.floor(bruto.ausentes * 100) / 100,
			nao: Math.floor(bruto.nao * 100) / 100
		};
		const soma =
			arred.sim + arred.abstencao + arred.obstrucao + arred.ausentes + arred.nao;
		const resto = Math.max(0, 100 - soma);
		return { ...arred, nao: arred.nao + resto };
	}

	$: resumoSafe = {
		...resumoVazio,
		...resumoVotos,
		sim: Number(resumoVotos?.sim) || 0,
		nao: Number(resumoVotos?.nao) || 0,
		abstencao: Number(resumoVotos?.abstencao) || 0,
		obstrucao: Number(resumoVotos?.obstrucao) || 0,
		ausentes: Number(resumoVotos?.ausentes) || 0,
		total: Number(resumoVotos?.total) || 0,
		totalGeral: Number(resumoVotos?.totalGeral) || 0
	};

	$: totalBase =
		resumoSafe.totalGeral ||
		resumoSafe.total ||
		resumoSafe.sim +
			resumoSafe.nao +
			resumoSafe.abstencao +
			resumoSafe.obstrucao +
			resumoSafe.ausentes ||
		0;

	$: larguras = calcularLarguras(totalBase, resumoSafe);
</script>

<section class="summary">
	{#if temMes}
		<div class="summary-header">
			<h2>Votação{temResultado && votacaoId ? ` ${votacaoId}` : ''}</h2>
			{#if temFimCurto}
				<span class="summary-note-inline">({fimTextoCurto})</span>
			{/if}
			<div class="summary-actions">
				<slot />
				{#if temResumoTexto}
					<button
						type="button"
						class="summary-note-trigger"
						aria-label="Ver texto do resumo"
						on:click={() => (mostrarNota = true)}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path
								d="M6 3.75h12a1.5 1.5 0 0 1 1.5 1.5v13.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V5.25A1.5 1.5 0 0 1 6 3.75zm1.5 4.5h9a.75.75 0 0 0 0-1.5h-9a.75.75 0 0 0 0 1.5zm0 4h9a.75.75 0 0 0 0-1.5h-9a.75.75 0 0 0 0 1.5zm0 4h6a.75.75 0 0 0 0-1.5h-6a.75.75 0 0 0 0 1.5z"
							/>
						</svg>
					</button>
				{/if}
			</div>
		</div>
		<div class="stacked" bind:this={stackedEl}>
			<div
				class="stacked-tooltip dica"
				class:visible={tooltipTexto}
				use:manterNaTela={tooltipPos}
				style={`left: ${tooltipPos.x}px; top: ${tooltipPos.y}px;`}
			>
				<span class="dica-rotulo"><i class="ponto" style={`background:${tooltipCor}`} />{tooltipTexto}</span>
				<span class="dica-valor">
					{tooltipValor}
					{#if totalBase}<small>{Math.round((Number(tooltipValor) / totalBase) * 100)}% dos votos</small>{/if}
				</span>
			</div>
			<div class="stacked-row">
			<button type="button" class="stacked-end stacked-end--sim" on:click={() => solicitarFiltro('Sim')}>
				<b>{resumoSafe.sim}</b><span>sim</span>
			</button>
			<div class="stacked-bar">
				<div
					class="segment segment--sim"
					class:segment--vazio={!resumoSafe.sim}
					class:segment--active={filtroVoto === 'Sim'}
					class:segment--hide={labelOculto(resumoSafe.sim, totalBase)}
					class:segment--dimmed={hoverTipo && hoverTipo !== 'Sim'}
					on:mouseenter={(event) => abrirTooltip('Sim', resumoSafe.sim, event)}
					on:mousemove={moverTooltip}
					on:mouseleave={fecharTooltip}
					on:focus={(event) => abrirTooltip('Sim', resumoSafe.sim, event)}
					on:blur={fecharTooltip}
					on:click={() => solicitarFiltro('Sim')}
					on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Sim')}
					role="button"
					aria-label={`Sim: ${resumoSafe.sim}`}
					style={`width: ${larguras.sim}%`}
					tabindex="0"
				>
				</div>
				<div
					class="segment segment--abstencao"
					class:segment--vazio={!resumoSafe.abstencao}
					class:segment--active={filtroVoto === 'Abstenção'}
					class:segment--hide={labelOculto(resumoSafe.abstencao, totalBase)}
					class:segment--dimmed={hoverTipo && hoverTipo !== 'Abstenção'}
					on:mouseenter={(event) => abrirTooltip('Abstenção', resumoSafe.abstencao, event)}
					on:mousemove={moverTooltip}
					on:mouseleave={fecharTooltip}
					on:focus={(event) => abrirTooltip('Abstenção', resumoSafe.abstencao, event)}
					on:blur={fecharTooltip}
					on:click={() => solicitarFiltro('Abstenção')}
					on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Abstenção')}
					role="button"
					aria-label={`Abstenção: ${resumoSafe.abstencao}`}
					style={`width: ${larguras.abstencao}%`}
					tabindex="0"
				>
				</div>
				<div
					class="segment segment--obstrucao"
					class:segment--vazio={!resumoSafe.obstrucao}
					class:segment--active={filtroVoto === 'Obstrução'}
					class:segment--hide={labelOculto(resumoSafe.obstrucao, totalBase)}
					class:segment--dimmed={hoverTipo && hoverTipo !== 'Obstrução'}
					on:mouseenter={(event) => abrirTooltip('Obstrução', resumoSafe.obstrucao, event)}
					on:mousemove={moverTooltip}
					on:mouseleave={fecharTooltip}
					on:focus={(event) => abrirTooltip('Obstrução', resumoSafe.obstrucao, event)}
					on:blur={fecharTooltip}
					on:click={() => solicitarFiltro('Obstrução')}
					on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Obstrução')}
					role="button"
					aria-label={`Obstrução: ${resumoSafe.obstrucao}`}
					style={`width: ${larguras.obstrucao}%`}
					tabindex="0"
				>
				</div>
				<div
					class="segment segment--ausentes"
					class:segment--vazio={!resumoSafe.ausentes}
					class:segment--active={filtroVoto === 'Ausentes'}
					class:segment--hide={labelOculto(resumoSafe.ausentes, totalBase)}
					class:segment--dimmed={hoverTipo && hoverTipo !== 'Ausentes'}
					on:mouseenter={(event) => abrirTooltip('Ausentes', resumoSafe.ausentes, event)}
					on:mousemove={moverTooltip}
					on:mouseleave={fecharTooltip}
					on:focus={(event) => abrirTooltip('Ausentes', resumoSafe.ausentes, event)}
					on:blur={fecharTooltip}
					on:click={() => solicitarFiltro('Ausentes')}
					on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Ausentes')}
					role="button"
					aria-label={`Ausentes: ${resumoSafe.ausentes}`}
					style={`width: ${larguras.ausentes}%`}
					tabindex="0"
				>
				</div>
				<div
					class="segment segment--nao"
					class:segment--vazio={!resumoSafe.nao}
					class:segment--active={filtroVoto === 'Não'}
					class:segment--hide={labelOculto(resumoSafe.nao, totalBase)}
					class:segment--dimmed={hoverTipo && hoverTipo !== 'Não'}
					on:mouseenter={(event) => abrirTooltip('Não', resumoSafe.nao, event)}
					on:mousemove={moverTooltip}
					on:mouseleave={fecharTooltip}
					on:focus={(event) => abrirTooltip('Não', resumoSafe.nao, event)}
					on:blur={fecharTooltip}
					on:click={() => solicitarFiltro('Não')}
					on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Não')}
					role="button"
					aria-label={`Não: ${resumoSafe.nao}`}
					style={`width: ${larguras.nao}%`}
					tabindex="0"
				>
				</div>
			</div>
			<button type="button" class="stacked-end stacked-end--nao" on:click={() => solicitarFiltro('Não')}>
				<b>{resumoSafe.nao}</b><span>não</span>
			</button>
			</div>
		</div>
	{/if}
	<div class="summary-filters">
		<slot name="filters" />
	</div>
	{#if mostrarNota}
		<div class="summary-note-modal" role="dialog" aria-modal="true">
			<div class="summary-note-backdrop" on:click={() => (mostrarNota = false)} />
			<div class="summary-note-card">
				<h3>Resumo da votação</h3>
				<p>{resumoTexto}</p>
				<button type="button" class="summary-note-close" on:click={() => (mostrarNota = false)}>
					Fechar
				</button>
			</div>
		</div>
	{/if}
</section>

<style>
	.summary {
		padding: calc(var(--grid) * 1.4) 0 calc(var(--grid) * 1.2);
		width: 100%;
	}

	h2 {
		margin: 0;
		font-size: calc(var(--grid) * 2.8);
		line-height: 1.1;
		white-space: nowrap;
	}

	.summary-header {
		display: flex;
		align-items: center;
		gap: calc(var(--grid) * 1.2);
		margin-bottom: calc(var(--grid) * 1.2);
	}

	.summary-actions {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--grid) * 1);
		margin-left: auto;
	}

	.summary-note-inline {
		font-size: var(--t-small);
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.summary-note-trigger {
		border: 1px solid var(--color-dark);
		background: transparent;
		color: var(--color-dark);
		border-radius: 999px;
		width: calc(var(--grid) * 3.6);
		height: calc(var(--grid) * 3.6);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background-color 180ms var(--ease), color 180ms var(--ease);
	}

	.summary-note-trigger:hover {
		background: var(--color-dark);
		color: var(--color-light);
	}

	.summary-note-trigger svg {
		width: 15px;
		height: 15px;
		fill: currentColor;
	}

	.summary-note-modal {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		z-index: 50;
	}

	.summary-note-backdrop {
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--color-dark) 45%, transparent);
		animation: fade 360ms var(--ease);
	}

	.summary-note-card {
		position: relative;
		background: var(--color-light);
		border-top: 1px solid var(--color-rule);
		padding: calc(var(--grid) * 3);
		width: min(580px, 90vw);
		box-shadow: var(--shadow-surface);
		animation: rise 360ms var(--ease);
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(28px);
		}
	}

	.summary-note-card h3 {
		margin: 0 0 calc(var(--grid) * 1.5);
		font-size: calc(var(--grid) * 2.8);
	}

	.summary-note-card p {
		margin: 0 0 calc(var(--grid) * 3);
		font-size: var(--t-body);
		line-height: 1.55;
	}

	.summary-note-close {
		border: 1px solid var(--color-dark);
		background: transparent;
		color: var(--color-dark);
		border-radius: 999px;
		padding: calc(var(--grid) * 0.9) calc(var(--grid) * 1.8);
		font: inherit;
		font-size: var(--t-label);
		font-weight: 500;
		cursor: pointer;
	}

	.summary-note-close:hover {
		background: var(--color-dark);
		color: var(--color-light);
	}

	.stacked {
		position: relative;
		margin-bottom: calc(var(--grid) * 1.2);
	}

	.stacked-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: calc(var(--grid) * 1.4);
	}

	.stacked-end {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		border: 0;
		background: none;
		padding: 0;
		font: inherit;
		cursor: pointer;
		transition: transform 180ms var(--ease);
	}

	.stacked-end:hover {
		transform: translateY(-1px);
	}

	.stacked-end b {
		font-family: var(--font-display);
		font-weight: 500;
		font-size: calc(var(--grid) * 3);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.stacked-end span {
		font-size: var(--t-small);
		font-weight: 600;
	}

	.stacked-end--sim {
		color: var(--vote-sim);
	}

	.stacked-end--nao {
		color: var(--vote-nao-texto);
		flex-direction: row-reverse;
	}

	.stacked-bar {
		display: flex;
		gap: 2px;
		border-radius: 999px;
		overflow: hidden;
		height: var(--barra-espessura);
	}

	.segment {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		color: #fff;
		font-size: var(--t-small);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		overflow: hidden;
		transform-origin: left center;
		animation: stacked-grow 600ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		transition: width 360ms var(--ease), opacity 180ms var(--ease), filter 180ms var(--ease),
			transform 180ms var(--ease);
	}

	.segment {
		min-width: 0;
	}

	.segment:hover {
		filter: brightness(1.1);
	}

	.segment--vazio {
		display: none;
	}

	.segment--dimmed {
		opacity: 0.25;
	}

	@keyframes stacked-grow {
		from {
			transform: scaleX(0);
		}
	}

	.segment--active {
		filter: brightness(0.85);
	}


	.segment--sim {
		background: var(--vote-sim);
	}

	.segment--nao {
		background: var(--vote-nao);
	}

	.segment--abstencao {
		background: var(--vote-abstencao);
	}

	.segment--obstrucao {
		background: var(--vote-obstrucao);
	}

	.segment--ausentes {
		background: var(--vote-ausentes);
		color: var(--color-dark);
	}

	.stacked-tooltip {
		position: absolute;
		margin-left: var(--desvio, 0px);
		transform: translate(-50%, -100%);
		opacity: 0;
		z-index: 30;
		transition: opacity 180ms var(--ease);
	}

	.stacked-tooltip.visible {
		opacity: 1;
	}






	.summary-filters {
		display: flex;
		flex-wrap: wrap;
	}

	@media (max-width: 600px) {
		.summary-note-inline {
			display: none;
		}

		.summary-header {
			gap: calc(var(--grid) * 0.6);
		}

		.summary-actions {
			gap: calc(var(--grid) * 0.4);
		}

		h2 {
			font-size: calc(var(--grid) * 1.9);
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
	@media (pointer: coarse) {
		.summary-note-trigger {
			width: 44px;
			height: 44px;
		}
	}
</style>
