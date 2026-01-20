<script>
	export let value = '';
	export let options = [];
	export let placeholder = 'Selecione';
	export let full = false;
</script>

<select bind:value class={`ui-select ${full ? 'ui-select--full' : ''}`} {...$$restProps}>
	{#if placeholder}
		<option value="" disabled>{placeholder}</option>
	{/if}
	{#each options as item}
		<option value={item.value}>{item.label}</option>
	{/each}
</select>

<style>
	.ui-select {
		display: block;
		padding: 4px calc(var(--grid) * 1.2);
		border: 1px solid var(--color-dark);
		border-radius: var(--radius-s);
		background: var(--color-dark);
		font-family: var(--font-primary);
		font-weight: 600;
		cursor: pointer;
		color: var(--color-tertiary);
		transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease;
	}

	.ui-select:hover {
		background: var(--color-tertiary);
		color: var(--color-dark);
		border: 1px solid var(--color-dark);
	}

    .ui-select:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--color-accent);
    }

	.ui-select--full {
		width: 100%;
	}

	@media (max-width: 372px) {
		.ui-select {
			width: 100%;
		}
	}
</style>
