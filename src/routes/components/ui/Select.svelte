<script>
	export let value = '';
	export let options = [];
	export let placeholder = 'Selecione';
	export let full = false;
</script>

<div class={`ui-select-wrapper ${full ? 'ui-select-wrapper--full' : ''}`}>
	<select bind:value class="ui-select" {...$$restProps}>
		{#if placeholder}
			<option value="" disabled>{placeholder}</option>
		{/if}
		{#each options as item}
			<option value={item.value}>{item.label}</option>
		{/each}
	</select>
	<svg class="ui-select__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path
			fill-rule="evenodd"
			clip-rule="evenodd"
			d="M12.7071 14.7071C12.3166 15.0976 11.6834 15.0976 11.2929 14.7071L6.29289 9.70711C5.90237 9.31658 5.90237 8.68342 6.29289 8.29289C6.68342 7.90237 7.31658 7.90237 7.70711 8.29289L12 12.5858L16.2929 8.29289C16.6834 7.90237 17.3166 7.90237 17.7071 8.29289C18.0976 8.68342 18.0976 9.31658 17.7071 9.70711L12.7071 14.7071Z"
		/>
	</svg>
</div>

<style>
	.ui-select-wrapper {
		position: relative;
		display: inline-block;
	}

	.ui-select {
		-webkit-appearance: none;
		appearance: none;
		padding: calc(var(--grid) * 0.9) calc(var(--grid) * 4) calc(var(--grid) * 0.9)
			calc(var(--grid) * 1.8);
		border: 1px solid var(--color-dark);
		border-radius: 999px;
		background: var(--color-light);
		color: var(--color-dark);
		font-family: var(--font-primary);
		font-size: var(--t-label);
		font-weight: 500;
		line-height: 1.2;
		cursor: pointer;
		max-width: 100%;
		transition: background-color 180ms var(--ease), color 180ms var(--ease);
	}

	.ui-select:hover {
		background: var(--color-dark);
		color: var(--color-light);
	}

	.ui-select:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.ui-select-wrapper--full,
	.ui-select-wrapper--full .ui-select {
		width: 100%;
	}

	.ui-select__icon {
		position: absolute;
		right: calc(var(--grid) * 1.4);
		top: 50%;
		transform: translateY(-50%);
		width: 16px;
		height: 16px;
		fill: currentColor;
		color: var(--color-dark);
		pointer-events: none;
		transition: color 180ms var(--ease);
	}

	.ui-select-wrapper:hover .ui-select__icon {
		color: var(--color-light);
	}
</style>
