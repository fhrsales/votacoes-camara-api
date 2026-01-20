<script>
	import { createEventDispatcher } from 'svelte';

	export let votacaoId = '';
	export let resumoTexto = '';
	export let resumoVotos = {};
	export let filtroVoto = '';
	export let fimTexto = '';

	const dispatch = createEventDispatcher();
	let tooltipTexto = '';
	let tooltipCor = '';

	const cores = {
		Sim: 'var(--color-success)',
		Não: 'var(--color-danger)',
		Abstenção: 'var(--color-warning)',
		Obstrução: 'var(--color-info)',
		Ausentes: 'var(--color-neutral)'
	};

	function abrirTooltip(tipo, valor) {
		tooltipTexto = `${tipo}: ${valor}`;
		tooltipCor = cores[tipo] || 'var(--color-text)';
	}

	function fecharTooltip() {
		tooltipTexto = '';
		tooltipCor = '';
	}

	function labelOculto(valor) {
		if (!resumoVotos?.totalGeral) return true;
		return (valor / resumoVotos.totalGeral) * 100 < 8;
	}

	function solicitarFiltro(tipo) {
		dispatch('filterChange', { tipo });
	}
</script>

<section class="summary">
	<h2>Resultado da votação {votacaoId}</h2>
	<p class="summary-note">
		{#if resumoTexto}
			{resumoTexto} ·
		{/if}
		Votado em {fimTexto}
	</p>
	<div class="stacked">
		<div
			class="stacked-tooltip"
			class:visible={tooltipTexto}
			style={tooltipCor ? `background: ${tooltipCor}` : ''}
		>
			{tooltipTexto}
		</div>
		<div class="stacked-bar">
			<div
				class="segment segment--sim"
				class:segment--active={filtroVoto === 'Sim'}
				class:segment--hide={labelOculto(resumoVotos.sim)}
				on:mouseenter={() => abrirTooltip('Sim', resumoVotos.sim)}
				on:mouseleave={fecharTooltip}
				on:focus={() => abrirTooltip('Sim', resumoVotos.sim)}
				on:blur={fecharTooltip}
				on:click={() => solicitarFiltro('Sim')}
				on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Sim')}
				role="button"
				style={`width: ${
					resumoVotos.totalGeral ? (resumoVotos.sim / resumoVotos.totalGeral) * 100 : 0
				}%`}
				tabindex="0"
			>
				<span class="segment-count">{resumoVotos.sim}</span>
			</div>
			<div
				class="segment segment--abstencao"
				class:segment--active={filtroVoto === 'Abstenção'}
				class:segment--hide={labelOculto(resumoVotos.abstencao)}
				on:mouseenter={() => abrirTooltip('Abstenção', resumoVotos.abstencao)}
				on:mouseleave={fecharTooltip}
				on:focus={() => abrirTooltip('Abstenção', resumoVotos.abstencao)}
				on:blur={fecharTooltip}
				on:click={() => solicitarFiltro('Abstenção')}
				on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Abstenção')}
				role="button"
				style={`width: ${
					resumoVotos.totalGeral ? (resumoVotos.abstencao / resumoVotos.totalGeral) * 100 : 0
				}%`}
				tabindex="0"
			>
				<span class="segment-count">{resumoVotos.abstencao}</span>
			</div>
			<div
				class="segment segment--obstrucao"
				class:segment--active={filtroVoto === 'Obstrução'}
				class:segment--hide={labelOculto(resumoVotos.obstrucao)}
				on:mouseenter={() => abrirTooltip('Obstrução', resumoVotos.obstrucao)}
				on:mouseleave={fecharTooltip}
				on:focus={() => abrirTooltip('Obstrução', resumoVotos.obstrucao)}
				on:blur={fecharTooltip}
				on:click={() => solicitarFiltro('Obstrução')}
				on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Obstrução')}
				role="button"
				style={`width: ${
					resumoVotos.totalGeral ? (resumoVotos.obstrucao / resumoVotos.totalGeral) * 100 : 0
				}%`}
				tabindex="0"
			>
				<span class="segment-count">{resumoVotos.obstrucao}</span>
			</div>
			<div
				class="segment segment--ausentes"
				class:segment--active={filtroVoto === 'Ausentes'}
				class:segment--hide={labelOculto(resumoVotos.ausentes)}
				on:mouseenter={() => abrirTooltip('Ausentes', resumoVotos.ausentes)}
				on:mouseleave={fecharTooltip}
				on:focus={() => abrirTooltip('Ausentes', resumoVotos.ausentes)}
				on:blur={fecharTooltip}
				on:click={() => solicitarFiltro('Ausentes')}
				on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Ausentes')}
				role="button"
				style={`width: ${
					resumoVotos.totalGeral ? (resumoVotos.ausentes / resumoVotos.totalGeral) * 100 : 0
				}%`}
				tabindex="0"
			>
				<span class="segment-count">{resumoVotos.ausentes}</span>
			</div>
			<div
				class="segment segment--nao"
				class:segment--active={filtroVoto === 'Não'}
				class:segment--hide={labelOculto(resumoVotos.nao)}
				on:mouseenter={() => abrirTooltip('Não', resumoVotos.nao)}
				on:mouseleave={fecharTooltip}
				on:focus={() => abrirTooltip('Não', resumoVotos.nao)}
				on:blur={fecharTooltip}
				on:click={() => solicitarFiltro('Não')}
				on:keydown={(e) => e.key === 'Enter' && solicitarFiltro('Não')}
				role="button"
				style={`width: ${
					resumoVotos.totalGeral ? (resumoVotos.nao / resumoVotos.totalGeral) * 100 : 0
				}%`}
				tabindex="0"
			>
				<span class="segment-count">{resumoVotos.nao}</span>
			</div>
		</div>
	</div>
  <div class="summary-footer">
    <slot />
  </div>
</section>

<style>
	.summary {
		margin: calc(var(--grid) * 2) 0 calc(var(--grid) * 2.5);
		padding: calc(var(--grid) * 1.5);
		border-radius: var(--radius-m);
		background: var(--color-surface);
        box-shadow: var(--shadow-2);
		position: sticky;
		top: calc(var(--grid) * 2);
		z-index: 2;
	}

	h2 {
		margin: 0 0 calc(var(--grid) * 1);
		font-size: calc(var(--grid) * 2);
	}

	.summary-note {
		margin: 0 0 calc(var(--grid) * 4.5);
		font-size: calc(var(--grid) * 1.5);
		color: var(--color-text-muted);
	}

	.stacked {
		position: relative;
		margin-top: calc(var(--grid) * 1);
		margin-bottom: calc(var(--grid) * 1);
	}

	.stacked-bar {
		display: flex;
		height: calc(var(--grid) * 2);
		background: var(--color-track);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.segment {
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
		bottom: calc(100% + (var(--grid) * 0.5));
		left: 50%;
		transform: translateX(-50%);
		padding: calc(var(--grid) * 0.5) calc(var(--grid) * 1);
		border-radius: var(--radius-m);
		background: var(--color-tooltip);
		color: var(--color-tertiary);
		font-size: calc(var(--grid) * 1.5);
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 120ms ease;
	}

	.stacked-tooltip.visible {
		opacity: 1;
	}

  .summary-footer {
    display: flex;
    flex-wrap: wrap;
    font-size: calc(var(--grid) * 1.5);
    color: var(--color-text);
  }
</style>
