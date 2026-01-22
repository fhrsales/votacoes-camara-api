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
        /* Basic styling for a button */
		padding: 10px 44px 10px 20px;
		border: none;
		border-radius: 25px; /* Use rounded corners as per HIG */
		color: white;
		font-size: 16px;
		cursor: pointer;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        background-color: var(--color-dark);
		/* The magic for the glass effect */
		backdrop-filter: blur(10px) saturate(1.5); /* Blur and saturate background */
		-webkit-backdrop-filter: blur(10px) saturate(1.5); /* Vendor prefix for compatibility */

		/* Add a subtle border or glow effect */
		border: 1px solid rgba(255, 255, 255, 0.2);


		/* display: block;
		padding: 4px calc(var(--grid) * 1.2);
		border: 1px solid var(--color-dark);
		border-radius: var(--radius-s);
		background: var(--color-dark);
		font-family: var(--font-primary);
		font-weight: 600;
		cursor: pointer;
		color: var(--color-tertiary);
		transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease; */
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

	.ui-select-wrapper--full {
		width: 100%;
	}

	@media (max-width: 372px) {
		.ui-select-wrapper {
			width: 100%;
		}
	}

	.ui-select__icon {
		position: absolute;
		right: 14px;
		top: 50%;
		transform: translateY(-50%);
		width: 18px;
		height: 18px;
		fill: var(--color-tertiary);
		pointer-events: none;
	}

	.ui-select-wrapper:hover .ui-select__icon,
	.ui-select:focus + .ui-select__icon {
		fill: var(--color-dark);
	}
</style>
