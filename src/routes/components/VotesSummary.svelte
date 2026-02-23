<script>
	import { createEventDispatcher } from 'svelte';

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

	function abrirTooltip(tipo, valor, event) {
		tooltipTexto = tipo;
		tooltipValor = String(valor);
		tooltipCor = cores[tipo] || 'var(--color-text)';
		hoverTipo = tipo;
		if (event?.currentTarget?.getBoundingClientRect) {
			const rect = event.currentTarget.getBoundingClientRect();
			tooltipPos = {
				x: event.clientX - rect.left + 12,
				y: event.clientY - rect.top - 12
			};
		}
	}

	function fecharTooltip() {
		tooltipTexto = '';
		tooltipValor = '';
		tooltipCor = '';
		hoverTipo = '';
	}

	function moverTooltip(event) {
		if (!event?.currentTarget?.getBoundingClientRect) return;
		const rect = event.currentTarget.getBoundingClientRect();
		tooltipPos = {
			x: event.clientX - rect.left + 12,
			y: event.clientY - rect.top - 12
		};
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
		<div class="stacked">
			<div
				class="stacked-tooltip"
				class:visible={tooltipTexto}
				style={`left: ${tooltipPos.x}px; top: ${tooltipPos.y}px;`}
			>
				<div>{tooltipTexto}</div>
				<hr />
				<div>{tooltipValor}</div>
			</div>
			<div class="stacked-bar">
				<div
					class="segment segment--sim"
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
					style={`width: ${larguras.sim}%`}
					tabindex="0"
				>
					<span class="segment-count">{resumoSafe.sim}</span>
				</div>
				<div
					class="segment segment--abstencao"
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
					style={`width: ${larguras.abstencao}%`}
					tabindex="0"
				>
					<span class="segment-count">{resumoSafe.abstencao}</span>
				</div>
				<div
					class="segment segment--obstrucao"
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
					style={`width: ${larguras.obstrucao}%`}
					tabindex="0"
				>
					<span class="segment-count">{resumoSafe.obstrucao}</span>
				</div>
				<div
					class="segment segment--ausentes"
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
					style={`width: ${larguras.ausentes}%`}
					tabindex="0"
				>
					<span class="segment-count">{resumoSafe.ausentes}</span>
				</div>
				<div
					class="segment segment--nao"
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
					style={`width: ${larguras.nao}%`}
					tabindex="0"
				>
					<span class="segment-count">{resumoSafe.nao}</span>
				</div>
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
		margin: calc(var(--grid) * 2) 0 calc(var(--grid) * 2.5);
		padding: 0;
		border-radius: var(--radius-m);
		background: transparent;
		box-shadow: none;
		position: sticky;
		top: 0;
		z-index: 2;
		box-sizing: border-box;
		width: 100%;
	}

	@media (max-width: 720px) {
		.summary {
			position: static;
		}
	}

	h2 {
		margin: 0;
		font-size: calc(var(--grid) * 2);
        width: -webkit-fill-available;
	}

	.summary-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: calc(var(--grid) * 1);
		margin-bottom: calc(var(--grid) * 1);
		flex-wrap: nowrap;
	}

	.summary-actions {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--grid) * 1);
	}

	.summary-header :global(.resultado-nav) {
		margin: 0;
	}

	.summary-note-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: calc(var(--grid) * 1);
		margin-top: calc(var(--grid) * 1);
	}

	.summary-note-inline {
		font-size: calc(var(--grid) * 1.5);
		color: var(--color-text-muted);
	}

	.summary-note-trigger {
		border: 1px solid color-mix(in srgb, var(--color-text) 45%, transparent);
		background: transparent;
		color: var(--color-text);
		border-radius: 999px;
		width: 34px;
		height: 34px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		cursor: pointer;
	}

	.summary-note-trigger svg {
		width: 16px;
		height: 16px;
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
		background: rgba(0, 0, 0, 0.45);
	}

	.summary-note-card {
		position: relative;
		background: var(--color-surface);
		border-radius: var(--radius-m);
		padding: calc(var(--grid) * 2);
		width: min(560px, 90vw);
		box-shadow: var(--shadow-2);
		z-index: 1;
	}

	.summary-note-card h3 {
		margin: 0 0 calc(var(--grid) * 1);
		font-size: calc(var(--grid) * 2);
	}

	.summary-note-card p {
		margin: 0 0 calc(var(--grid) * 2);
		font-size: calc(var(--grid) * 1.6);
		line-height: 1.5;
		color: var(--color-text);
	}

	.summary-note-close {
		border: 1px solid var(--color-dark);
		background: var(--color-tertiary);
		color: var(--color-dark);
		border-radius: 999px;
		padding: 8px 16px;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
	}

	.stacked {
		position: relative;
		/* margin-top: calc(var(--grid) * 1); */
		margin-bottom: calc(var(--grid) * 1);
		z-index: 1;
	}

	.stacked-bar {
		display: flex;
		height: calc(var(--grid) * 3);
		background: var(--color-track);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.segment {
		width: 0;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		color: var(--color-tertiary);
		font-size: calc(var(--grid) * 1.5);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		text-shadow: 0 1px 2px var(--color-shadow);
		cursor: pointer;
		transition: width 350ms ease;
		transform-origin: left center;
		animation: stacked-grow 350ms ease;
	}

	.segment--dimmed {
		opacity: 0.1;
	}

	.segment + .segment {
		box-shadow: -1px 0 0 var(--color-track);
	}

	@keyframes stacked-grow {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}

	.segment--active {
		outline: var(--outline-strong);
		outline-offset: -2px;
	}

	.segment--hide .segment-count {
		display: none;
	}

	.segment--sim {
		background: var(--color-success);
	}

	.segment--nao {
		background: var(--color-danger);
	}

	.segment--abstencao {
		background: var(--color-warning);
		color: var(--color-text);
		text-shadow: none;
	}

	.segment--obstrucao {
		background: var(--color-info);
	}

	.segment--ausentes {
		background: var(--color-neutral);
	}

	.stacked-tooltip {
		position: absolute;
		transform: translateX(-50%);
		padding: calc(var(--grid) * 0.5) calc(var(--grid) * 1);
		border-radius: var(--radius-s);
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: var(--shadow-2);
		font-size: calc(var(--grid) * 1.4);
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		z-index: 9999;
		transition: opacity 120ms ease;
	}

	.stacked-tooltip.visible {
		opacity: 1;
	}

	.stacked-tooltip hr {
		border: none;
		border-top: 1px solid color-mix(in srgb, var(--color-text) 25%, transparent);
		margin: calc(var(--grid) * 0.4) 0;
	}

	.summary-filters {
		display: flex;
		flex-wrap: wrap;
		font-size: calc(var(--grid) * 1.5);
		color: var(--color-text);
		margin-bottom: calc(var(--grid) * 1.5);
	}
</style>
