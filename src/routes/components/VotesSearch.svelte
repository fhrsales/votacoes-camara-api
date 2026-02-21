<script>
	import Select from './ui/Select.svelte';
	export let dataInicio = '';
	export let carregandoLista = false;
	export let erroLista = '';
	export let listaVotacoes = [];
	export let opcoesMes = null;
	export let onListar = () => {};
	export let onSelect = (item) => {};
	export let inline = false;
	export let showStatus = true;
	let ultimoMes = '';

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

	$: if (dataInicio && dataInicio !== ultimoMes) {
		ultimoMes = dataInicio;
		onListar();
	}
</script>

{#if inline}
	<div class="search-inline">
		<Select
			aria-label="Escolha um período de votação"
			bind:value={dataInicio}
			options={opcoesDisponiveis}
			placeholder="Escolha um período de votação"
		/>
	</div>
	{#if showStatus}
		{#if erroLista}
			<p class="error">{erroLista}</p>
		{/if}
		{#if carregandoLista}
			<p class="loading">Buscando votações...</p>
		{/if}
	{/if}
{:else}
	<section class="search-panel">
		<div class="search-card">
			<div class="search-row">
				<Select
					aria-label="Escolha um período de votação"
					bind:value={dataInicio}
					options={opcoesDisponiveis}
					placeholder="Escolha um período de votação"
				/>
			</div>
			{#if erroLista}
				<p class="error">{erroLista}</p>
			{/if}
		</div>

		{#if carregandoLista}
			<p class="loading">Buscando votações...</p>
		{/if}
	</section>
{/if}

<style>
	.search-panel {
		margin-bottom: calc(var(--grid) * 2);
		max-width: 100%;
	}

	.search-inline {
		display: inline-flex;
		align-items: end;
	}

	.search-row {
		display: flex;
		gap: calc(var(--grid) * 1);
		flex-wrap: nowrap;
		align-items: end;
        justify-content: center;
		margin-bottom: calc(var(--grid) * 0.5);
		font-size: calc(var(--grid) * 1.5);
	}

	.error {
		color: var(--color-error);
		margin: calc(var(--grid) * 0.5) 0 0;
		font-size: calc(var(--grid) * 1.5);
	}

	.loading {
		margin: calc(var(--grid) * 1) 0 0;
		color: var(--color-text-subtle);
		font-size: calc(var(--grid) * 1.4);
	}
</style>
