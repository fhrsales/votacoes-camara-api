<script>
	import { createEventDispatcher } from 'svelte';

	export let size = 'default';
	export let full = false;
	export let type = 'button';
	export let variant = 'default';
	export let shape = 'default';

	const dispatch = createEventDispatcher();
</script>

<button
	{type}
	class={`ui-button ${size === 'small' ? 'ui-button--small' : ''} ${
		full ? 'ui-button--full' : ''
	} ${variant === 'primary' ? 'ui-button--primary' : ''} ${
		variant === 'ghost' ? 'ui-button--ghost' : ''
	} ${
		shape === 'circle' ? 'ui-button--circle' : ''
	}`}
	on:click={(event) => dispatch('click', event)}
	{...$$restProps}
>
	<slot />
</button>

<style>
	.ui-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: calc(var(--grid) * 0.6);
		padding: calc(var(--grid) * 0.9) calc(var(--grid) * 1.8);
		border: 1px solid var(--color-dark);
		border-radius: 999px;
		background: transparent;
		color: var(--color-dark);
		font-family: var(--font-primary);
		font-size: var(--t-control);
		font-weight: 500;
		line-height: 1.2;
		cursor: pointer;
		transition: background-color 180ms var(--ease), color 180ms var(--ease),
			border-color 180ms var(--ease);
	}

	.ui-button:hover:not(:disabled) {
		background: var(--color-dark);
		color: var(--color-light);
	}

	.ui-button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.ui-button--small {
		padding: calc(var(--grid) * 0.6) calc(var(--grid) * 1.4);
	}

	.ui-button--circle,
	.ui-button--small.ui-button--circle {
		width: calc(var(--grid) * 3.6);
		height: calc(var(--grid) * 3.6);
		padding: 0;
	}

	.ui-button--full {
		width: 100%;
	}

	.ui-button--ghost {
		border-color: var(--color-rule);
	}
	@media (pointer: coarse) {
		.ui-button--circle,
		.ui-button--small.ui-button--circle {
			width: 44px;
			height: 44px;
		}

		.ui-button:active:not(:disabled) {
			transform: scale(0.94);
		}
	}

	.ui-button {
		-webkit-tap-highlight-color: transparent;
		transition-property: background-color, color, border-color, transform;
	}
</style>
