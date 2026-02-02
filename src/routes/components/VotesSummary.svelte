<script>
	import { createEventDispatcher } from 'svelte';

	export let votacaoId = '';
	export let resumoTexto = '';
	export let resumoVotos = {};
	export let filtroVoto = '';
	export let fimTexto = '';

	const dispatch = createEventDispatcher();
	let tooltipTexto = '';
	let tooltipValor = '';
	let tooltipCor = '';
	let tooltipPos = { x: 0, y: 0 };
	let hoverTipo = '';

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

	function labelOculto(valor) {
		if (!resumoVotos?.totalGeral) return true;
		return (valor / resumoVotos.totalGeral) * 100 < 8;
	}

	function solicitarFiltro(tipo) {
		dispatch('filterChange', { tipo });
	}

	function calcularLarguras() {
		const total = resumoVotos?.totalGeral || 0;
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
			sim: (resumoVotos.sim / total) * 100,
			abstencao: (resumoVotos.abstencao / total) * 100,
			obstrucao: (resumoVotos.obstrucao / total) * 100,
			ausentes: (resumoVotos.ausentes / total) * 100,
			nao: (resumoVotos.nao / total) * 100
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

	$: larguras = calcularLarguras();
</script>

<section class="summary">
	<div class="summary-header">
		<h2>Resultado da votação {votacaoId}</h2>
		<slot />
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
				class:segment--hide={labelOculto(resumoVotos.sim)}
				class:segment--dimmed={hoverTipo && hoverTipo !== 'Sim'}
				on:mouseenter={(event) => abrirTooltip('Sim', resumoVotos.sim, event)}
				on:mousemove={moverTooltip}
				on:mouseleave={fecharTooltip}
				on:focus={(event) => abrirTooltip('Sim', resumoVotos.sim, event)}
				on:blur={fecharTooltip}
				on:click={() => solicitarFiltro('Sim')}
				on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Sim')}
				role="button"
				style={`width: ${larguras.sim}%`}
				tabindex="0"
			>
				<span class="segment-count">{resumoVotos.sim}</span>
			</div>
			<div
				class="segment segment--abstencao"
				class:segment--active={filtroVoto === 'Abstenção'}
				class:segment--hide={labelOculto(resumoVotos.abstencao)}
				class:segment--dimmed={hoverTipo && hoverTipo !== 'Abstenção'}
				on:mouseenter={(event) => abrirTooltip('Abstenção', resumoVotos.abstencao, event)}
				on:mousemove={moverTooltip}
				on:mouseleave={fecharTooltip}
				on:focus={(event) => abrirTooltip('Abstenção', resumoVotos.abstencao, event)}
				on:blur={fecharTooltip}
				on:click={() => solicitarFiltro('Abstenção')}
				on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Abstenção')}
				role="button"
				style={`width: ${larguras.abstencao}%`}
				tabindex="0"
			>
				<span class="segment-count">{resumoVotos.abstencao}</span>
			</div>
			<div
				class="segment segment--obstrucao"
				class:segment--active={filtroVoto === 'Obstrução'}
				class:segment--hide={labelOculto(resumoVotos.obstrucao)}
				class:segment--dimmed={hoverTipo && hoverTipo !== 'Obstrução'}
				on:mouseenter={(event) => abrirTooltip('Obstrução', resumoVotos.obstrucao, event)}
				on:mousemove={moverTooltip}
				on:mouseleave={fecharTooltip}
				on:focus={(event) => abrirTooltip('Obstrução', resumoVotos.obstrucao, event)}
				on:blur={fecharTooltip}
				on:click={() => solicitarFiltro('Obstrução')}
				on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Obstrução')}
				role="button"
				style={`width: ${larguras.obstrucao}%`}
				tabindex="0"
			>
				<span class="segment-count">{resumoVotos.obstrucao}</span>
			</div>
			<div
				class="segment segment--ausentes"
				class:segment--active={filtroVoto === 'Ausentes'}
				class:segment--hide={labelOculto(resumoVotos.ausentes)}
				class:segment--dimmed={hoverTipo && hoverTipo !== 'Ausentes'}
				on:mouseenter={(event) => abrirTooltip('Ausentes', resumoVotos.ausentes, event)}
				on:mousemove={moverTooltip}
				on:mouseleave={fecharTooltip}
				on:focus={(event) => abrirTooltip('Ausentes', resumoVotos.ausentes, event)}
				on:blur={fecharTooltip}
				on:click={() => solicitarFiltro('Ausentes')}
				on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Ausentes')}
				role="button"
				style={`width: ${larguras.ausentes}%`}
				tabindex="0"
			>
				<span class="segment-count">{resumoVotos.ausentes}</span>
			</div>
			<div
				class="segment segment--nao"
				class:segment--active={filtroVoto === 'Não'}
				class:segment--hide={labelOculto(resumoVotos.nao)}
				class:segment--dimmed={hoverTipo && hoverTipo !== 'Não'}
				on:mouseenter={(event) => abrirTooltip('Não', resumoVotos.nao, event)}
				on:mousemove={moverTooltip}
				on:mouseleave={fecharTooltip}
				on:focus={(event) => abrirTooltip('Não', resumoVotos.nao, event)}
				on:blur={fecharTooltip}
				on:click={() => solicitarFiltro('Não')}
				on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Não')}
				role="button"
				style={`width: ${larguras.nao}%`}
				tabindex="0"
			>
				<span class="segment-count">{resumoVotos.nao}</span>
			</div>
		</div>
	</div>
  <div class="summary-filters">
		<slot name="filters" />
  </div>
	<p class="summary-note">
		{#if resumoTexto}
			{resumoTexto}
		{/if}
		Votado em {fimTexto}
	</p>
</section>

<style>
	.summary {
		margin: calc(var(--grid) * 2) 0 calc(var(--grid) * 2.5);
		padding: calc(var(--grid) * 1.5);
		border-radius: var(--radius-m);
		background: var(--color-surface);
        box-shadow: var(--shadow-2);
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

	.summary-header :global(.resultado-nav) {
		margin: 0;
	}

	.summary-note {
		margin: calc(var(--grid) * 1.5) 0;
		font-size: calc(var(--grid) * 1.5);
		color: var(--color-text-muted);
		max-height: calc(1.4em * 4);
		overflow-y: auto;
		line-height: 1.4;
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
