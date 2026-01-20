<script>
	import { createEventDispatcher } from 'svelte';

	export let size = 'default';
	export let full = false;
	export let type = 'button';
	export let variant = 'default';

	const dispatch = createEventDispatcher();
</script>

<button
	{type}
	class={`ui-button ${size === 'small' ? 'ui-button--small' : ''} ${
		full ? 'ui-button--full' : ''
	} ${variant === 'primary' ? 'ui-button--primary' : ''}`}
	on:click={(event) => dispatch('click', event)}
	{...$$restProps}
>
	<slot />
</button>

<style>
	.ui-button {
		background: var(--color-surface);
		border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
		padding: calc(var(--grid) * 0.5) calc(var(--grid) * 1.5);
		border-radius: var(--radius-s);		cursor: pointer;
        font-family: var(--font-primary);
		font-weight: 600;
		font-size: calc(var(--grid) * 1.5);
		color: var(--color-primary);
	}

	.ui-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ui-button--small {
		padding: calc(var(--grid) * 0.5) calc(var(--grid) * 1);
	}

	.ui-button--full {
		width: 100%;
	}

	.ui-button--primary {
		background: var(--color-dark);
        border: 1px solid var(--color-dark);
		color: var(--color-tertiary);
	}

    .ui-button--primary:hover {
        background: var(--color-tertiary);
        color: var(--color-dark);
        border: 1px solid var(--color-dark);
        transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease;
    }

    @media (max-width: 372px) {
		.ui-button {
			width: 100%;
            text-align: left;
		}
	}
</style>
