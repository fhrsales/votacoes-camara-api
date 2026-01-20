<script>
	import { onMount } from 'svelte';
	import { format, parseISO, addMonths, addDays, endOfMonth } from 'date-fns';
	import { ptBR } from 'date-fns/locale';
    import VotesSearch from './components/VotesSearch.svelte';
    import VotesSummary from './components/VotesSummary.svelte';
    import VotesTable from './components/VotesTable.svelte';
    import Button from './components/ui/Button.svelte';
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

	function atualizarFiltro(tipo) {
		filtroVoto = filtroVoto === tipo ? '' : tipo;
	}

	const API_BASE = 'https://dadosabertos.camara.leg.br/api/v2';
	const CORS_PROXIES = [
		'https://api.allorigins.win/raw?url=',
		'https://cors.isomorphic-git.org/',
		'https://thingproxy.freeboard.io/fetch/'
	];
	const RETRY_ATTEMPTS = 2;
	const RETRY_BASE_DELAY = 250;

	async function fetchJson(url, errorMessage) {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(errorMessage ?? `Falha na requisição (${response.status})`);
		}
		return response.json();
	}

	async function fetchJsonProxy(path, errorMessage) {
		const upstream = `${API_BASE}${path}`;
		let lastError;
		for (const proxy of CORS_PROXIES) {
			const url =
				proxy === 'https://api.allorigins.win/raw?url='
					? `${proxy}${encodeURIComponent(upstream)}`
					: `${proxy}${upstream}`;
			for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt += 1) {
				try {
					return await fetchJson(url, errorMessage);
				} catch (error) {
					lastError = error;
					if (attempt < RETRY_ATTEMPTS) {
						const delay = RETRY_BASE_DELAY * (attempt + 1);
						await new Promise((resolve) => setTimeout(resolve, delay));
					}
				}
			}
		}
		throw lastError ?? new Error(errorMessage ?? 'Falha ao buscar dados.');
	}

	async function getResumoTexto(id) {
		try {
			const detalhesData = await fetchJsonProxy(
				`/votacoes/${id}`,
				`Falha ao buscar detalhes (${id})`
			);
			const detalhes = detalhesData?.dados || {};
			const afetadas = detalhes?.proposicoesAfetadas || [];
			const objetos = detalhes?.objetosPossiveis || [];
			let ementa = afetadas[0]?.ementa || objetos[0]?.ementa || '';

			if (!ementa) {
				const uriProposicao =
					detalhes?.uriProposicaoObjeto || afetadas[0]?.uri || objetos[0]?.uri || '';
				const idProposicao = uriProposicao.split('/').pop();
				if (idProposicao) {
					try {
						const propData = await fetchJsonProxy(
							`/proposicoes/${idProposicao}`,
							`Falha ao buscar proposição (${idProposicao})`
						);
						ementa = propData?.dados?.ementa || '';
					} catch {
						ementa = '';
					}
				}
			}

			return ementa || detalhes.ementa || '';
		} catch {
			return '';
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
			const data = await fetchJsonProxy(
				`/votacoes/${votacaoId}/votos`,
				`Falha ao buscar votos (${votacaoId})`
			);
			const lista = Array.isArray(data.dados) ? data.dados : [];
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
			votos = lista
				.filter((voto) => voto.tipoVoto !== 'Artigo 17')
				.map((voto) => ({ ...voto, dataRegistroVoto: parseISO(voto.dataRegistroVoto) }));
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
			resumoTexto = await getResumoTexto(votacaoId);
		} catch (error) {
			erroVotos = 'Ocorreu um erro ao buscar votos.';
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
			const inicio = parseISO(`${dataInicio}-01`);
			const fim = endOfMonth(parseISO(`${dataInicio}-01`));
			if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
				erroLista = 'Mes invalido.';
				listaVotacoes = [];
				return;
			}
			carregandoLista = true;
			erroLista = '';
			const mapa = new Map();
			let cursor = inicio;
			while (cursor <= fim) {
				const chunkFim = addMonths(cursor, 3) > fim ? fim : addMonths(cursor, 3);
				const params = new URLSearchParams({
					dataInicio: format(cursor, 'yyyy-MM-dd'),
					dataFim: format(chunkFim, 'yyyy-MM-dd'),
					itens: '100',
					ordem: 'DESC'
				});
				const data = await fetchJsonProxy(
					`/votacoes?${params.toString()}`,
					'Falha ao listar votacoes'
				);
				const baseLista = Array.isArray(data.dados) ? data.dados : [];
				baseLista.forEach((item) => {
					if (item && item.id != null) mapa.set(String(item.id), item);
				});
				cursor = addDays(chunkFim, 1);
			}

			const resultadoRegex =
				/Sim:\s*\d+|Não:\s*\d+|Abstenç[ãa]o:\s*\d+|Obstruç[ãa]o:\s*\d+|Total:\s*\d+/i;
			const listaUnica = Array.from(mapa.values());
			listaVotacoes = listaUnica
				.map((item) => {
					const descricao = item?.descricao || '';
					const hasResultado = resultadoRegex.test(descricao);
					return { ...item, hasResultado };
				})
				.filter((item) => item.hasResultado === true);
			if (votacaoId) {
				selecionadoIndex = listaVotacoes.findIndex((item) => String(item.id) === String(votacaoId));
			} else {
				selecionadoIndex = -1;
			}
		} catch (error) {
			erroLista = 'Ocorreu um erro ao buscar votacoes.';
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

	onMount(fetchVotos);
</script>

<main class="container">
	<h1 class="pagina-titulo">Como votou seu deputado?</h1>
	<p>Demonstração de uso de API que integra dados abertos de votações da Câmara dos Deputados, estruturando votos nominaispor deputado e por votação.</p>
    <VotesSearch
      bind:dataInicio
      {carregandoLista}
      {erroLista}
      {listaVotacoes}
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
		<VotesSummary
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
					>
						Anterior
					</Button>
					<span class="resultado-status">{getNavStatus()}</span>
					<Button
						size="small"
						on:click={() => selecionarPorIndice(selecionadoIndex + 1, 1)}
						disabled={selecionadoIndex < 0 || selecionadoIndex >= listaVotacoes.length - 1}
                        variant="primary"
					>
						Próximo
					</Button>
				</div>
			</div>
		</VotesSummary>
		<VotesTable votos={votosExibidos} />
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
</style>
