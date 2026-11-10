<script context="module">
	// Where each group's indicator sat on the previous page: on the next page it starts there
	// and slides to the new tab, so moving between pages reads as one control changing state
	const ultimas = {};
</script>

<script>
	import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';

	/** [{ chave, rotulo, curto?, href?, desabilitado?, titulo? }] */
	export let itens = [];
	export let ativo = '';
	/** Name that ties this control to its twin on other pages */
	export let grupo = '';
	export let rotulo = '';
	/**
	 * 'segmento': small switch on a grey track, the active option a raised white thumb (a filter)
	 * 'sublinhado': text tabs over a rule, the active one underlined (the page's sections)
	 */
	export let estilo = 'segmento';

	const dispatch = createEventDispatcher();
	let caixa;
	let pos = null; // { x, w }
	let anima = false;
	let observador;

	function medir() {
		const el = caixa?.querySelector('[data-ativo="true"]');
		if (!el) return null;
		return { x: el.offsetLeft, w: el.offsetWidth };
	}

	async function mover(suave = true) {
		await tick();
		const novo = medir();
		if (!novo) {
			pos = null;
			return;
		}
		anima = suave;
		pos = novo;
		if (grupo) ultimas[grupo] = novo;
	}

	$: ativo, estilo, caixa && mover(true);

	onMount(() => {
		const antes = grupo ? ultimas[grupo] : null;
		const agora = medir();
		if (antes && agora && (antes.x !== agora.x || antes.w !== agora.w)) {
			anima = false;
			pos = antes;
			requestAnimationFrame(() => requestAnimationFrame(() => mover(true)));
		} else {
			mover(false);
		}
		observador = new ResizeObserver(() => mover(false));
		observador.observe(caixa);
	});
	onDestroy(() => observador?.disconnect());
</script>

<!-- Navigation links, not an ARIA tablist: the current page is marked with aria-current,
     and the in-place house switch (buttons) with aria-pressed -->
<div class={`abas ${estilo}`} bind:this={caixa} role="group" aria-label={rotulo}>
	{#if pos}
		<span class="indicador" class:anima style={`transform:translateX(${pos.x}px);width:${pos.w}px`} aria-hidden="true" />
	{/if}
	{#each itens as it (it.chave)}
		{#if it.href && !it.desabilitado}
			<a
				href={it.href}
				aria-current={ativo === it.chave ? 'page' : undefined}
				data-ativo={ativo === it.chave}
				class:ativo={ativo === it.chave}
				title={it.titulo}
				on:click={() => dispatch('escolher', it.chave)}
			>
				{#if it.curto}<span class="longo">{it.rotulo}</span><span class="curto">{it.curto}</span>{:else}{it.rotulo}{/if}
			</a>
		{:else}
			<button
				type="button"
				aria-pressed={it.desabilitado ? undefined : ativo === it.chave}
				aria-disabled={it.desabilitado ? 'true' : undefined}
				aria-describedby={it.desabilitado && it.titulo ? `${grupo}-${it.chave}-motivo` : undefined}
				data-ativo={ativo === it.chave}
				class:ativo={ativo === it.chave}
				class:desabilitado={it.desabilitado}
				title={it.titulo}
				on:click={() => !it.desabilitado && dispatch('escolher', it.chave)}
			>
				{#if it.curto}<span class="longo">{it.rotulo}</span><span class="curto">{it.curto}</span>{:else}{it.rotulo}{/if}
			</button>
			{#if it.desabilitado && it.titulo}<span class="sr" id={`${grupo}-${it.chave}-motivo`}>{it.titulo}</span>{/if}
		{/if}
	{/each}
</div>

<style>
	.abas {
		position: relative;
		display: inline-flex;
		isolation: isolate;
	}

	.indicador {
		position: absolute;
		left: 0;
		z-index: -1;
		pointer-events: none;
	}

	/* It slides in 360ms, the DS change-of-state time */
	.indicador.anima {
		transition: transform 360ms var(--ease), width 360ms var(--ease);
	}

	a,
	button {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 0;
		background: transparent;
		color: var(--color-text-muted);
		font: inherit;
		font-size: var(--t-control);
		font-weight: 500;
		line-height: 1.2;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition: color 180ms var(--ease), background-color 180ms var(--ease);
	}

	a:hover,
	button:hover:not(.desabilitado) {
		color: var(--color-text);
	}

	.ativo,
	.ativo:hover {
		color: var(--color-text);
	}

	/* The app turns focus rings off globally; keyboard focus still needs one here */
	a:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.desabilitado {
		color: color-mix(in srgb, var(--color-dark) 38%, transparent);
		cursor: not-allowed;
	}

	a:active,
	button:active:not(.desabilitado) {
		transform: scale(0.97);
	}

	/* ---- segmento: the house filter, a small switch ---- */
	.segmento {
		padding: 3px;
		border-radius: 999px;
		background: var(--color-track);
	}

	.segmento .indicador {
		top: 3px;
		bottom: 3px;
		border-radius: 999px;
		background: var(--color-surface);
		box-shadow: 0 1px 2px color-mix(in srgb, var(--color-dark) 14%, transparent),
			0 0 0 1px color-mix(in srgb, var(--color-dark) 6%, transparent);
	}

	.segmento a,
	.segmento button {
		min-height: 32px;
		padding: 0 calc(var(--grid) * 1.6);
		border-radius: 999px;
		font-size: var(--t-small);
	}

	.segmento .ativo {
		font-weight: 600;
	}

	.segmento a:focus-visible,
	.segmento button:focus-visible {
		outline-offset: 0;
	}

	/* ---- sublinhado: the sections, plain tabs over a rule ---- */
	.sublinhado {
		gap: calc(var(--grid) * 0.4);
		box-shadow: inset 0 -1px 0 var(--color-rule);
	}

	.sublinhado .indicador {
		bottom: 0;
		height: 2px;
		border-radius: 2px;
		background: var(--color-text);
	}

	.sublinhado a,
	.sublinhado button {
		min-height: 44px;
		padding: 0 calc(var(--grid) * 1.4);
		border-radius: 8px 8px 0 0;
	}

	.sublinhado a:hover:not(.ativo),
	.sublinhado button:hover:not(.ativo):not(.desabilitado) {
		background: var(--color-surface-muted);
	}

	.sublinhado .ativo {
		font-weight: 600;
	}

	.sublinhado a:focus-visible,
	.sublinhado button:focus-visible {
		outline-offset: -2px;
	}

	.curto {
		display: none;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 600px) {
		.segmento a,
		.segmento button {
			padding: 0 calc(var(--grid) * 1.4);
		}

		.sublinhado a,
		.sublinhado button {
			flex: 1 1 auto;
			padding: 0 calc(var(--grid) * 1.1);
		}

		.longo {
			display: none;
		}

		.curto {
			display: inline;
		}
	}
</style>
