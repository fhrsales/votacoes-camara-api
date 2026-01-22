<script>
	import { onMount } from 'svelte';
	import { format, parseISO } from 'date-fns';
	import ptBR from 'date-fns/locale/pt-BR';
	import { base } from '$app/paths';
	import VotesSearch from './components/VotesSearch.svelte';
	import Button from './components/ui/Button.svelte';
	import AdBanner from './components/AdBanner.svelte';
	export let votacaoId;

	let votos = [];
	let carregandoVotos = false;
	let erroVotos = '';
	let carregandoLista = false;
	let erroLista = '';
	let listaVotacoes = [];
	let selecionadoIndex = -1;
	let dataInicio = '';
	let resumoVotos = {};
	let resumoTexto = '';
	let filtroVoto = '';
	let opcoesMes = [];
	let votosDisponiveis = new Set();
	let ultimaAtualizacao = '';
	let votosIndexOk = true;
	let VotesSummaryComponent = null;
	let VotesTableComponent = null;

	$: votosExibidos =
		filtroVoto === 'Ausentes'
			? []
			: filtroVoto
			? votos.filter((voto) => voto.tipoVoto === filtroVoto)
			: votos;

	$: fimTexto =
		votos.length > 0
			? format(votos[0].dataRegistroVoto, "d 'de' MMMM 'de' yyyy, 'às' HH:mm", { locale: ptBR })
			: '';

	$: ultimaAtualizacaoTexto =
		ultimaAtualizacao
			? format(parseISO(ultimaAtualizacao), "d 'de' MMMM 'de' yyyy, 'às' HH:mm", { locale: ptBR })
			: '';

	function atualizarFiltro(tipo) {
		filtroVoto = filtroVoto === tipo ? '' : tipo;
	}

	async function carregarComponentesResultados() {
		if (VotesSummaryComponent && VotesTableComponent) return;
		const [summaryModule, tableModule] = await Promise.all([
			import('./components/VotesSummary.svelte'),
			import('./components/VotesTable.svelte')
		]);
		VotesSummaryComponent = summaryModule.default;
		VotesTableComponent = tableModule.default;
	}

	const DATA_BASE = `${base}/data`;

	async function fetchJson(url, errorMessage) {
		const response = await fetch(url);
		if (!response.ok) {
			const error = new Error(errorMessage ?? `Falha na requisição (${response.status})`);
			error.status = response.status;
			throw error;
		}
		return response.json();
	}

	async function carregarIndices() {
		try {
			const data = await fetchJson(`${DATA_BASE}/votacoes/index.json`);
			if (Array.isArray(data?.meses)) {
				opcoesMes = data.meses;
			}
		} catch {
			opcoesMes = [];
		}

		try {
			const data = await fetchJson(`${DATA_BASE}/votos/index.json`);
			if (Array.isArray(data?.ids)) {
				votosDisponiveis = new Set(data.ids.map((id) => String(id)));
			}
			votosIndexOk = true;
		} catch {
			votosDisponiveis = new Set();
			votosIndexOk = false;
		}

		try {
			const data = await fetchJson(`${DATA_BASE}/last-run.json?ts=${Date.now()}`);
			if (data?.generatedAt) ultimaAtualizacao = data.generatedAt;
		} catch {
			ultimaAtualizacao = '';
		}
	}

	async function fetchVotos() {
		try {
			if (!votacaoId) {
				erroVotos = 'Selecione uma votacao para buscar os votos.';
				votos = [];
				return;
			}
			filtroVoto = '';
			carregandoVotos = true;
			erroVotos = '';
			const data = await fetchJson(
				`${DATA_BASE}/votos/${votacaoId}.json`,
				`Falha ao buscar votos (${votacaoId})`
			);
			const lista = Array.isArray(data?.votos) ? data.votos : [];
			if (lista.length === 0) {
				erroVotos = '';
				votos = [];
				resumoVotos = {};
				resumoTexto = '';
				if (votacaoId) {
					const idAtual = String(votacaoId);
					const indiceAtual = listaVotacoes.findIndex((item) => String(item.id) === idAtual);
					listaVotacoes = listaVotacoes.filter((item) => String(item.id) !== idAtual);
					if (listaVotacoes.length > 0) {
						const proximo = Math.min(indiceAtual, listaVotacoes.length - 1);
						selecionarPorIndice(proximo, 1);
					} else {
						selecionadoIndex = -1;
					}
				}
				return;
			}
			votos = lista.map((voto) => ({
				...voto,
				dataRegistroVoto: parseISO(voto.dataRegistroVoto)
			}));
			const contagem = votos.reduce(
				(acc, voto) => {
					switch (voto.tipoVoto) {
						case 'Sim':
							acc.sim += 1;
							break;
						case 'Não':
							acc.nao += 1;
							break;
						case 'Abstenção':
							acc.abstencao += 1;
							break;
						case 'Obstrução':
							acc.obstrucao += 1;
							break;
					}
					return acc;
				},
				{ sim: 0, nao: 0, abstencao: 0, obstrucao: 0 }
			);
			const { sim, nao, abstencao, obstrucao } = contagem;
			const total = votos.length;
			const ausentes = Math.max(0, 513 - total);
			const totalGeral = 513;
			resumoVotos = { sim, nao, abstencao, obstrucao, ausentes, total, totalGeral };
			resumoTexto = data?.resumoTexto || '';
			carregarComponentesResultados();
		} catch (error) {
			if (error?.status === 404) {
				erroVotos = 'Sem dados para esta votacao.';
			} else {
				erroVotos = 'Ocorreu um erro ao buscar votos.';
			}
			console.error('Ocorreu um erro:', error);
			votos = [];
			resumoVotos = {};
			resumoTexto = '';
		} finally {
			carregandoVotos = false;
		}
	}

	async function fetchListaVotacoes() {
		try {
			if (!dataInicio) {
				erroLista = 'Selecione um mes para buscar votacoes.';
				listaVotacoes = [];
				return;
			}
			if (!votosIndexOk) {
				erroLista = 'Dados locais incompletos. Rode npm run fetch:data.';
				listaVotacoes = [];
				return;
			}
			const inicio = parseISO(`${dataInicio}-01`);
			if (Number.isNaN(inicio.getTime())) {
				erroLista = 'Mes invalido.';
				listaVotacoes = [];
				return;
			}
			carregandoLista = true;
			erroLista = '';
			const data = await fetchJson(
				`${DATA_BASE}/votacoes/${dataInicio}.json`,
				'Falha ao listar votacoes'
			);
			const baseLista = Array.isArray(data?.votacoes) ? data.votacoes : [];
			if (votosDisponiveis.size > 0) {
				listaVotacoes = baseLista
					.map((item) => ({ ...item, hasVotos: votosDisponiveis.has(String(item?.id)) }))
					.filter((item) => item.hasVotos);
			} else {
				listaVotacoes = baseLista;
			}
			if (votacaoId) {
				selecionadoIndex = listaVotacoes.findIndex((item) => String(item.id) === String(votacaoId));
			} else {
				selecionadoIndex = -1;
			}
		} catch (error) {
			if (error?.status === 404) {
				erroLista = 'Sem dados para este mes.';
			} else {
				erroLista = 'Ocorreu um erro ao buscar votacoes.';
			}
			console.error('Ocorreu um erro:', error);
			listaVotacoes = [];
			selecionadoIndex = -1;
		} finally {
			carregandoLista = false;
		}
	}

	function selecionarVotacao(item) {
		filtroVoto = '';
		votacaoId = item?.id ? String(item.id) : '';
		selecionadoIndex = listaVotacoes.findIndex((i) => String(i.id) === String(votacaoId));
		fetchVotos();
	}

	function selecionarPorIndice(indice, direcao = 1) {
		if (listaVotacoes.length === 0) return;
		let i = indice;
		while (i >= 0 && i < listaVotacoes.length) {
			const item = listaVotacoes[i];
			if (item?.hasResultado !== false) {
				selecionadoIndex = i;
				selecionarVotacao(item);
				return;
			}
			i += direcao;
		}
	}

    function getNavStatus() {
      if (listaVotacoes.length === 0) return '0/0';
      const atual = selecionadoIndex >= 0 ? selecionadoIndex + 1 : 0;
      return `${atual}/${listaVotacoes.length}`;
    }

	function limparLista() {
      listaVotacoes = [];
      selecionadoIndex = -1;
      votacaoId = '';
      votos = [];
      resumoVotos = {};
      resumoTexto = '';
      erroVotos = '';
      filtroVoto = '';
    }

	onMount(() => {
		carregarIndices();
	});
</script>

<main class="container">
	<AdBanner />
	<h1 class="pagina-titulo">Voto a voto</h1>
	{#if ultimaAtualizacaoTexto}
		<p class="atualizacao">Atualizado em {ultimaAtualizacaoTexto}</p>
	{/if}
	{#if !votosIndexOk}
		<p class="erro">Dados locais incompletos. Rode <code>npm run fetch:data</code>.</p>
	{/if}
	<p>Demonstração de uso de API que integra dados abertos de votações da Câmara dos Deputados, estruturando votos nominaispor deputado e por votação.</p>
    <VotesSearch
      bind:dataInicio
      {carregandoLista}
      {erroLista}
      {listaVotacoes}
	  {opcoesMes}
      onListar={fetchListaVotacoes}
      onLimpar={limparLista}
      onSelect={selecionarVotacao}
    />
	{#if erroVotos}
		<p class="erro">{erroVotos}</p>
	{/if}

	{#if carregandoVotos}
		<p>Buscando votos...</p>
	{:else if votos.length > 0}
		{#if VotesSummaryComponent}
			<svelte:component
				this={VotesSummaryComponent}
				{votacaoId}
				{resumoTexto}
				{resumoVotos}
				{filtroVoto}
				{fimTexto}
				on:filterChange={(event) => atualizarFiltro(event.detail.tipo)}
			>
				<div class="resultado-nav">
					<div class="resultado-total">Total de votos: {resumoVotos.total}</div>
					<div class="resultado-controles">
						<Button
							size="small"
							on:click={() => selecionarPorIndice(selecionadoIndex - 1, -1)}
							disabled={selecionadoIndex <= 0}
							variant="primary"
							shape="circle"
							aria-label="Anterior"
						>
							<svg
								class="resultado-icon"
								viewBox="0 0 1024 1024"
								xmlns="http://www.w3.org/2000/svg"
								aria-hidden="true"
								focusable="false"
							>
								<path d="M685.248 104.704a64 64 0 0 1 0 90.496L368.448 512l316.8 316.8a64 64 0 0 1-90.496 90.496L232.704 557.248a64 64 0 0 1 0-90.496l362.048-362.048a64 64 0 0 1 90.496 0z" />
							</svg>
						</Button>
						<span class="resultado-status">{getNavStatus()}</span>
						<Button
							size="small"
							on:click={() => selecionarPorIndice(selecionadoIndex + 1, 1)}
							disabled={selecionadoIndex < 0 || selecionadoIndex >= listaVotacoes.length - 1}
							variant="primary"
							shape="circle"
							aria-label="Próximo"
						>
							<svg
								class="resultado-icon resultado-icon--next"
								viewBox="0 0 1024 1024"
								xmlns="http://www.w3.org/2000/svg"
								aria-hidden="true"
								focusable="false"
							>
								<path d="M685.248 104.704a64 64 0 0 1 0 90.496L368.448 512l316.8 316.8a64 64 0 0 1-90.496 90.496L232.704 557.248a64 64 0 0 1 0-90.496l362.048-362.048a64 64 0 0 1 90.496 0z" />
							</svg>
						</Button>
					</div>
				</div>
			</svelte:component>
		{/if}
		{#if VotesTableComponent}
			<svelte:component this={VotesTableComponent} votos={votosExibidos} />
		{/if}
	{:else}
		<p />
	{/if}
</main>

<style>
	.container {
		width: 100%;
		max-width: calc(var(--grid) * 85);
		margin: 0 auto;
		padding: calc(var(--grid) * 2);
		box-sizing: border-box;
	}

	@media (max-width: 420px) {
		.container {
			padding: calc(var(--grid) * 1.5);
		}
	}

	.erro {
		color: var(--color-error);
		margin: calc(var(--grid) * 0.5) 0 calc(var(--grid) * 1.5);
		font-size: calc(var(--grid) * 1.5);
	}

	.pagina-titulo {
		margin: 0 0 calc(var(--grid) * 1.5);
		font-size: calc(var(--grid) * 3.5);
		font-weight: 700;
	}

	.atualizacao {
		margin: calc(var(--grid) * -1) 0 calc(var(--grid) * 1.5);
		color: var(--color-text-subtle);
		font-size: calc(var(--grid) * 1.4);
	}

	.resultado-nav {
		display: flex;
		width: 100%;
		justify-content: space-between;
		align-items: center;
		gap: calc(var(--grid) * 1);
		font-size: calc(var(--grid) * 1.5);
	}

	.resultado-total {
		font-weight: 600;
	}

	.resultado-controles {
		display: flex;
		align-items: center;
		gap: calc(var(--grid) * 1);
	}

	.resultado-status {
		color: var(--color-text-subtle);
		font-size: calc(var(--grid) * 1.5);
	}

	.resultado-icon {
		width: 14px;
		height: 14px;
		fill: currentColor;
	}

	.resultado-icon--next {
		transform: rotate(180deg);
	}
</style>
