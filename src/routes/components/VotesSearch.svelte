<script>
	import Button from './ui/Button.svelte';
	import Select from './ui/Select.svelte';
	export let dataInicio = '';
	export let carregandoLista = false;
	export let erroLista = '';
	export let listaVotacoes = [];
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

	const opcoesMes = gerarOpcoesMeses();

	function handleListar() {
		onListar();
	}
</script>

<section class="search-panel">
	<div class="search-card">
		<div class="search-row">
			<Select bind:value={dataInicio} options={opcoesMes} placeholder="Mês/Ano" />
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
		max-height: calc(var(--grid) * 12);
		overflow-y: auto;
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
</style>
