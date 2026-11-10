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

	$: ativo, caixa && mover(true);

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

<div class="abas" bind:this={caixa} role="tablist" aria-label={rotulo}>
	{#if pos}
		<span class="indicador" class:anima style={`transform:translateX(${pos.x}px);width:${pos.w}px`} aria-hidden="true" />
	{/if}
	{#each itens as it (it.chave)}
		{#if it.href && !it.desabilitado}
			<a
				href={it.href}
				role="tab"
				aria-selected={ativo === it.chave}
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
				role="tab"
				aria-selected={ativo === it.chave}
				data-ativo={ativo === it.chave}
				class:ativo={ativo === it.chave}
				disabled={it.desabilitado}
				title={it.titulo}
				on:click={() => dispatch('escolher', it.chave)}
			>
				{#if it.curto}<span class="longo">{it.rotulo}</span><span class="curto">{it.curto}</span>{:else}{it.rotulo}{/if}
			</button>
		{/if}
	{/each}
</div>

<style>
	.abas {
		position: relative;
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--color-rule);
		border-radius: 999px;
		background: var(--color-light);
		isolation: isolate;
	}

	/* The dark pill under the active tab; it slides (360ms, the DS change-of-state time) */
	.indicador {
		position: absolute;
		top: 3px;
		bottom: 3px;
		left: 0;
		z-index: -1;
		border-radius: 999px;
		background: var(--color-dark);
	}

	.indicador.anima {
		transition: transform 360ms var(--ease), width 360ms var(--ease);
	}

	a,
	button {
		position: relative;
		display: inline-flex;
		align-items: center;
		padding: calc(var(--grid) * 0.8) calc(var(--grid) * 2);
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--color-text-muted);
		font: inherit;
		font-size: var(--t-control);
		font-weight: 500;
		line-height: 1.2;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition: color 180ms var(--ease);
	}

	a:hover,
	button:hover:not(:disabled) {
		color: var(--color-dark);
	}

	.ativo,
	.ativo:hover {
		color: var(--color-light) !important;
	}

	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	a:active,
	button:active:not(:disabled) {
		transform: scale(0.97);
	}

	.curto {
		display: none;
	}

	@media (max-width: 600px) {
		a,
		button {
			padding: calc(var(--grid) * 0.8) calc(var(--grid) * 1.3);
		}

		.longo {
			display: none;
		}

		.curto {
			display: inline;
		}
	}
</style>
