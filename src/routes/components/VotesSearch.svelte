<script>
	import Button from './ui/Button.svelte';
	import Select from './ui/Select.svelte';
	export let dataInicio = '';
	export let carregandoLista = false;
	export let erroLista = '';
	export let listaVotacoes = [];
	export let opcoesMes = null;
	export let onListar = () => {};
	export let onLimpar = () => {};
	export let onSelect = (item) => {};

	const meses = [
		'Janeiro',
		'Fevereiro',
		'Março',
		'Abril',
		'Maio',
		'Junho',
		'Julho',
		'Agosto',
		'Setembro',
		'Outubro',
		'Novembro',
		'Dezembro'
	];

	function pad2(valor) {
		return String(valor).padStart(2, '0');
	}

	function gerarOpcoesMeses() {
		const hoje = new Date();
		const opcoes = [];
		for (let i = 0; i < 36; i += 1) {
			const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
			const ano = data.getFullYear();
			const mesNumero = pad2(data.getMonth() + 1);
			const label = `${meses[data.getMonth()]} ${ano}`;
			opcoes.push({ value: `${ano}-${mesNumero}`, label });
		}
		return opcoes;
	}

	$: opcoesDisponiveis = Array.isArray(opcoesMes) && opcoesMes.length > 0 ? opcoesMes : gerarOpcoesMeses();

	function handleListar() {
		onListar();
	}
</script>

<section class="search-panel">
	<div class="search-card">
		<div class="search-row">
			<Select
				aria-label="Mês/Ano"
				bind:value={dataInicio}
				options={opcoesDisponiveis}
				placeholder="Mês/Ano"
			/>
			<Button
				on:click={listaVotacoes.length > 0 ? onLimpar : handleListar}
				disabled={carregandoLista}
				variant="primary"
			>
				{listaVotacoes.length > 0 ? 'Limpar' : carregandoLista ? 'Buscando...' : 'Listar votações'}
			</Button>
		</div>
		{#if erroLista}
			<p class="error">{erroLista}</p>
		{/if}
	</div>

	{#if listaVotacoes.length > 0}
		<ul class="votes-list">
			{#each listaVotacoes as item}
				<li class="vote-item">
					<button class="vote-button" type="button" on:click={() => onSelect(item)}>
						<div class="vote-info">
							<span class="vote-id">{item.id}</span>
						</div>
					</button>
				</li>
			{/each}
		</ul>
		{#if listaVotacoes.length > 5}
			<div class="votes-more">
				<span>Role para ver mais IDs</span>
				<svg
					class="votes-more-icon"
					fill="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
					focusable="false"
				>
					<path
						d="M7,3.70710678 L7,10.5 C7,10.7761424 6.77614237,11 6.5,11 C6.22385763,11 6,10.7761424 6,10.5 L6,3.70710678 L4.85355339,4.85355339 C4.65829124,5.04881554 4.34170876,5.04881554 4.14644661,4.85355339 C3.95118446,4.65829124 3.95118446,4.34170876 4.14644661,4.14644661 L6.14644661,2.14644661 C6.34170876,1.95118446 6.65829124,1.95118446 6.85355339,2.14644661 L8.85355339,4.14644661 C9.04881554,4.34170876 9.04881554,4.65829124 8.85355339,4.85355339 C8.65829124,5.04881554 8.34170876,5.04881554 8.14644661,4.85355339 L7,3.70710678 Z M14,9.5 L14,12.0474376 C14,12.3783481 13.8839855,12.698786 13.6721417,12.9529985 C13.1720143,13.5531514 12.2800608,13.6342381 11.6799078,13.1341106 L10.7560738,12.3642489 C10.4736449,12.1288916 10.11764,12 9.75,12 C9.48363526,12 9.24082605,12.1526146 9.12532205,12.3926334 L9.08962348,12.4668155 C8.95447865,12.7476481 8.99541029,13.0814869 9.19439734,13.321352 L13.607865,18.6414804 C14.3217788,19.502054 15.3818498,20 16.5,20 C18.9852814,20 21,17.9852814 21,15.5 L21,11.5 C21,11.2238576 20.7761424,11 20.5,11 C20.2238576,11 20,11.2238576 20,11.5 L20,12.5 C20,12.7761424 19.7761424,13 19.5,13 C19.2238576,13 19,12.7761424 19,12.5 L19,10.5 C19,10.2238576 18.7761424,10 18.5,10 C18.2238576,10 18,10.2238576 18,10.5 L18,12.5 C18,12.7761424 17.7761424,13 17.5,13 C17.2238576,13 17,12.7761424 17,12.5 L17,9.5 C17,9.22385763 16.7761424,9 16.5,9 C16.2238576,9 16,9.22385763 16,9.5 L16,12.5 C16,12.7761424 15.7761424,13 15.5,13 C15.2238576,13 15,12.7761424 15,12.5 L15,5.5 C15,5.22385763 14.7761424,5 14.5,5 C14.2238576,5 14,5.22385763 14,5.5 L14,9.5 Z M13,9.49999981 L13,5.5 C13,4.67157288 13.6715729,4 14.5,4 C15.3284271,4 16,4.67157288 16,5.5 L16,8.08535285 C16.1563895,8.03007711 16.3246823,8 16.5,8 C17.191734,8 17.7741062,8.46823386 17.9474595,9.10504462 C18.1184541,9.03725677 18.3048761,9 18.5,9 C19.191734,9 19.7741062,9.46823386 19.9474595,10.1050446 C20.1184541,10.0372568 20.3048761,10 20.5,10 C21.3284271,10 22,10.6715729 22,11.5 L22,15.5 C22,18.5375661 19.5375661,21 16.5,21 C15.0842933,21 13.7421216,20.3695431 12.8382246,19.279958 L8.42475695,13.9598296 C7.97611908,13.4190278 7.88383427,12.6663521 8.18853292,12.0331845 L8.2242315,11.9590024 C8.50634865,11.3727595 9.09940726,11 9.75,11 C10.3515765,11 10.9341143,11.2109078 11.3962582,11.5960277 L12.3200922,12.3658894 C12.4959683,12.5124527 12.7573571,12.4886901 12.9039205,12.3128141 C12.9660017,12.2383166 13,12.1444116 13,12.0474376 L13,9.5 Z"
					/>
				</svg>
			</div>
		{/if}
	{/if}
</section>

<style>
	.search-panel {
		margin-bottom: calc(var(--grid) * 2);
		max-width: 100%;
	}

	.search-row {
		display: flex;
		gap: calc(var(--grid) * 1);
		flex-wrap: nowrap;
		align-items: end;
		margin-bottom: calc(var(--grid) * 0.5);
		font-size: calc(var(--grid) * 1.5);
	}

	.error {
		color: var(--color-error);
		margin: calc(var(--grid) * 0.5) 0 0;
		font-size: calc(var(--grid) * 1.5);
	}

	.votes-list {
		list-style: none;
		padding: 0;
		margin: calc(var(--grid) * 1.5) 0 0;
		display: grid;
		gap: calc(var(--grid) * 0.5);
		max-height: calc(var(--grid) * 22);
		overflow-y: auto;
		position: relative;
	}

	.vote-item {
		margin: 0;
	}

	.vote-button {
		width: 100%;
		display: flex;
		justify-content: space-between;
		gap: calc(var(--grid) * 1.5);
		padding: calc(var(--grid) * 1) calc(var(--grid) * 1);
		border-radius: var(--radius-s);
		background: var(--color-tertiary);
        color: var(--color-dark);
		border: 1px solid transparent;
		align-items: center;
		cursor: pointer;
		transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
		text-align: left;
	}

	.vote-button:hover {
		background: var(--color-dark);
        color: var(--color-tertiary);
		transition: background 0.3s ease, border-color 0.3s ease, transform 0.3s ease;
	}

	.vote-button:focus-visible {
		outline: var(--outline-strong);
		outline-offset: calc(var(--grid) * 0.5);
	}

	.vote-info {
		display: flex;
		flex-direction: column;
		gap: calc(var(--grid) * 0.5);
		line-height: 1.2;
	}

	.vote-id {
		font-size: calc(var(--grid) * 1.5);
		font-weight: 600;
	}

	@media (max-width: 720px) {
		.search-row {
			flex-wrap: wrap;
		}
	}

	.votes-list::after {
		content: '';
		position: sticky;
		bottom: 0;
		left: 0;
		right: 0;
		display: block;
		height: calc(var(--grid) * 2.5);
		background: linear-gradient(to bottom, transparent, var(--color-surface));
		pointer-events: none;
	}

	.votes-more {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--grid) * 0.5);
		text-align: right;
		margin-top: calc(var(--grid) * 0.75);
		font-size: calc(var(--grid) * 1.3);
		color: var(--color-text-subtle);
		justify-content: flex-end;
		width: 100%;
	}

	.votes-more-icon {
		width: 18px;
		height: 18px;
	}
</style>
