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
		padding: calc(var(--grid) * 1.4) 0 calc(var(--grid) * 1.2);
		width: 100%;
	}

	h2 {
		margin: 0;
		font-size: calc(var(--grid) * 2.4);
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
		font-size: var(--t-label);
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
		border-top: 2px solid var(--color-dark);
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

	.stacked-bar {
		display: flex;
		gap: 2px;
		height: calc(var(--grid) * 2.6);
	}

	.segment {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		padding-left: 8px;
		color: #fff;
		font-size: calc(var(--grid) * 1.4);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		overflow: hidden;
		transform-origin: left center;
		animation: stacked-grow 600ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		transition: width 360ms var(--ease), opacity 180ms var(--ease), filter 180ms var(--ease);
	}

	.segment:first-child {
		border-radius: 3px 0 0 3px;
	}

	.segment:last-child {
		border-radius: 0 3px 3px 0;
	}

	.segment:hover {
		filter: brightness(1.08);
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
		box-shadow: inset 0 -4px 0 var(--color-dark);
	}

	.segment--hide .segment-count {
		display: none;
	}

	.segment--sim {
		background: var(--vote-sim);
	}

	.segment--nao {
		background: var(--vote-nao);
		justify-content: flex-end;
		padding: 0 8px 0 0;
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
		transform: translate(-50%, -100%);
		display: flex;
		gap: 8px;
		padding: 5px 12px;
		border-radius: 999px;
		background: var(--color-dark);
		color: var(--color-light);
		box-shadow: var(--shadow-2);
		font-size: calc(var(--grid) * 1.4);
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		z-index: 30;
		transition: opacity 180ms var(--ease);
	}

	.stacked-tooltip.visible {
		opacity: 1;
	}

	.stacked-tooltip hr {
		border: 0;
		border-left: 1px solid color-mix(in srgb, var(--color-light) 35%, transparent);
		margin: 0;
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
