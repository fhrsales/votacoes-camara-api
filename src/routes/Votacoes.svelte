<script>
	import { onMount } from 'svelte';
	import { format, parseISO } from 'date-fns';
	import ptBR from 'date-fns/locale/pt-BR';
	import { base } from '$app/paths';
	import VotesSearch from './components/VotesSearch.svelte';
	import Button from './components/ui/Button.svelte';
	import Select from './components/ui/Select.svelte';
	import BubbleChart from './components/BubbleChart.svelte';
	import AdBanner from './components/AdBanner.svelte';
	export let votacaoId;

	let votos = [];
	let votosRegistrados = [];
	let votosComAusentes = [];
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
	let filtroEstado = '';
	let filtroPartido = '';
	let filtroNome = '';
	let layoutBolhas = 'pack';
	let legislaturasIndex = [];
	let deputadosLegislatura = [];

	$: votosExibidos = votosComAusentes
		.filter((voto) => (filtroVoto ? voto.tipoVoto === filtroVoto : true))
		.filter((voto) =>
			filtroEstado ? voto?.deputado_?.siglaUf === filtroEstado : true
		)
		.filter((voto) =>
			filtroPartido ? voto?.deputado_?.siglaPartido === filtroPartido : true
		)
		.filter((voto) =>
			filtroNome
				? voto?.deputado_?.nome?.toLowerCase?.().includes(filtroNome.trim().toLowerCase())
				: true
		);

	$: votosFiltradosBase = votosComAusentes
		.filter((voto) => (filtroEstado ? voto?.deputado_?.siglaUf === filtroEstado : true))
		.filter((voto) =>
			filtroPartido ? voto?.deputado_?.siglaPartido === filtroPartido : true
		);

	function calcularResumo(lista) {
		const contagem = lista.reduce(
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
					case 'Ausentes':
						acc.ausentes += 1;
						break;
				}
				return acc;
			},
			{ sim: 0, nao: 0, abstencao: 0, obstrucao: 0, ausentes: 0 }
		);
		const { sim, nao, abstencao, obstrucao, ausentes } = contagem;
		const total = lista.length;
		return {
			sim,
			nao,
			abstencao,
			obstrucao,
			ausentes,
			total,
			totalGeral: total
		};
	}

	$: resumoVotosGrafico =
		filtroEstado || filtroPartido ? calcularResumo(votosFiltradosBase) : resumoVotos;

	$: opcoesEstado = [
		{ value: '', label: 'Todos os estados' },
		...Array.from(new Set(votosComAusentes.map((voto) => voto?.deputado_?.siglaUf).filter(Boolean)))
			.sort()
			.map((sigla) => ({ value: sigla, label: sigla }))
	];

	$: opcoesPartido = [
		{ value: '', label: 'Todos os partidos' },
		...Array.from(new Set(votosComAusentes.map((voto) => voto?.deputado_?.siglaPartido).filter(Boolean)))
			.sort()
			.map((sigla) => ({ value: sigla, label: sigla }))
	];

	function agruparPorComTipo(lista, getter) {
		const mapa = new Map();
		for (const item of lista) {
			const label = getter(item);
			const tipo = item?.tipoVoto;
			if (!label || !tipo) continue;
			const chave = `${label}|||${tipo}`;
			mapa.set(chave, { label, tipo, value: (mapa.get(chave)?.value || 0) + 1 });
		}

		const maxPorLabel = new Map();
		for (const entry of mapa.values()) {
			const atual = maxPorLabel.get(entry.label) || 0;
			if (entry.value > atual) maxPorLabel.set(entry.label, entry.value);
		}

		const labelMarcado = new Set();
		return Array.from(mapa.values())
			.sort((a, b) => b.value - a.value)
			.map((item) => {
				const max = maxPorLabel.get(item.label);
				const showLabel = item.value === max && !labelMarcado.has(item.label);
				if (showLabel) labelMarcado.add(item.label);
				return { ...item, showLabel };
			});
	}

	$: dadosPorPartido = agruparPorComTipo(votosExibidos, (voto) => voto?.deputado_?.siglaPartido);
	$: dadosPorEstado = agruparPorComTipo(votosExibidos, (voto) => voto?.deputado_?.siglaUf);

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

	$: votosComAusentes = (() => {
		if (!deputadosLegislatura.length) return votosRegistrados;
		const idsVotaram = new Set(votosRegistrados.map((voto) => voto?.deputado_?.id).filter(Boolean));
		const dataRegistro = votosRegistrados[0]?.dataRegistroVoto ?? null;
		const ausentes = deputadosLegislatura
			.filter((dep) => dep?.id && !idsVotaram.has(dep.id))
			.map((dep) => ({
				tipoVoto: 'Ausentes',
				dataRegistroVoto: dataRegistro,
				deputado_: dep
			}));
		return [...votosRegistrados, ...ausentes];
	})();

	function encontrarLegislaturaId(data) {
		if (!data || legislaturasIndex.length === 0) return null;
		const dataRef = data instanceof Date ? data : parseISO(String(data));
		if (Number.isNaN(dataRef.getTime())) return null;
		const item = legislaturasIndex.find((leg) => {
			const inicio = leg?.dataInicio ? parseISO(leg.dataInicio) : null;
			const fim = leg?.dataFim ? parseISO(leg.dataFim) : null;
			if (!inicio || !fim) return false;
			return dataRef >= inicio && dataRef <= fim;
		});
		return item?.id ?? null;
	}

	async function carregarDeputadosLegislatura(dataRegistro) {
		deputadosLegislatura = [];
		const id = encontrarLegislaturaId(dataRegistro);
		if (!id) return;
		try {
			const data = await fetchJson(
				`${DATA_BASE}/deputados/legislaturas/legislatura-${id}.json`,
				`Falha ao buscar deputados da legislatura ${id}`
			);
			deputadosLegislatura = Array.isArray(data?.deputados) ? data.deputados : [];
		} catch {
			deputadosLegislatura = [];
		}
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

		try {
			const data = await fetchJson(`${DATA_BASE}/deputados/legislaturas/index.json`);
			legislaturasIndex = Array.isArray(data?.legislaturas) ? data.legislaturas : [];
		} catch {
			legislaturasIndex = [];
		}
	}

	async function fetchVotos() {
		try {
			if (!votacaoId) {
				erroVotos = 'Selecione uma votacao para buscar os votos.';
			votos = [];
			votosRegistrados = [];
			deputadosLegislatura = [];
			return;
		}
		filtroVoto = '';
		filtroEstado = '';
		filtroPartido = '';
		filtroNome = '';
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
			votosRegistrados = [];
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
		votosRegistrados = lista.map((voto) => ({
			...voto,
			dataRegistroVoto: parseISO(voto.dataRegistroVoto)
		}));
		const dataRegistro = votosRegistrados[0]?.dataRegistroVoto ?? null;
		await carregarDeputadosLegislatura(dataRegistro);
		votos = votosRegistrados;

		const contagem = votosRegistrados.reduce(
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
		const total = votosRegistrados.length;
		const totalGeral = deputadosLegislatura.length || 513;
		const ausentes = Math.max(0, totalGeral - total);
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
			votosRegistrados = [];
			deputadosLegislatura = [];
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
		filtroEstado = '';
		filtroPartido = '';
		filtroNome = '';
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
	  dataInicio = '';
      votos = [];
      votosRegistrados = [];
      deputadosLegislatura = [];
      resumoVotos = {};
      resumoTexto = '';
      erroVotos = '';
      filtroVoto = '';
      filtroEstado = '';
      filtroPartido = '';
      filtroNome = '';
    }

	onMount(() => {
		carregarIndices();
	});
</script>

<main class="container">
	<AdBanner />
	<h1 class="pagina-titulo">Voto a Voto: Monitorando a Democracia em Tempo Real</h1>
	{#if ultimaAtualizacaoTexto}
		<p class="atualizacao">Atualizado em {ultimaAtualizacaoTexto}</p>
	{/if}
	{#if !votosIndexOk}
		<p class="erro">Dados locais incompletos. Rode <code>npm run fetch:data</code>.</p>
	{/if}
	<p>Ferramenta automatizada de transparência que converte dados brutos da API oficial em insights visuais, permitindo acompanhar e analisar todas as votações da Câmara dos Deputados desde outubro de 2022.</p>
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
				resumoVotos={resumoVotosGrafico}
				{filtroVoto}
				{fimTexto}
				on:filterChange={(event) => atualizarFiltro(event.detail.tipo)}
			>
				<div class="resultado-nav">
					<div class="resultado-total">Total de votos: {resumoVotosGrafico.total}</div>
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
				<div class="resultado-filtros" slot="filters">
					<Select
						bind:value={filtroNome}
						options={[
							{ value: '', label: 'Todos os deputados' },
							...Array.from(
								new Set(votosComAusentes.map((voto) => voto?.deputado_?.nome).filter(Boolean))
							)
								.sort()
								.map((nome) => ({ value: nome, label: nome }))
						]}
						placeholder=""
						aria-label="Filtrar por deputado"
					/>
					<Select
						bind:value={filtroEstado}
						options={opcoesEstado}
						placeholder=""
						aria-label="Filtrar por estado"
					/>
					<Select
						bind:value={filtroPartido}
						options={opcoesPartido}
						placeholder=""
						aria-label="Filtrar por partido"
					/>
				</div>
			</svelte:component>
		{/if}
		{#if VotesTableComponent}
			<svelte:component this={VotesTableComponent} votos={votosExibidos} />
		{/if}
	{:else}
		<p />
	{/if}

	{#if votos.length > 0}
		<div class="resultado-graficos">
			<div class="resultado-graficos-grid">
				<BubbleChart
					title="Votação por partido"
					items={dadosPorPartido}
					layoutMode={layoutBolhas}
				/>
				<BubbleChart
					title="Votação por estado"
					items={dadosPorEstado}
					layoutMode={layoutBolhas}
				/>
			</div>
			<button
				type="button"
				class="resultado-graficos-toggle"
				on:click={() => (layoutBolhas = layoutBolhas === 'pack' ? 'stack' : 'pack')}
			>
				{layoutBolhas === 'pack' ? 'Agrupar' : 'Desagrupar'}
			</button>
		</div>
	{/if}
</main>

<style>
	.container {
		width: 100%;
		max-width: calc(var(--grid) * 110);
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
		justify-content: flex-end;
		align-items: center;
		gap: calc(var(--grid) * 1);
		font-size: calc(var(--grid) * 1.5);
	}

	.resultado-total {
		font-weight: 600;
		padding-left: calc(var(--grid) * 1);
		padding-right: calc(var(--grid) * 1);
		border-left: 1px solid color-mix(in srgb, var(--color-text) 50%, transparent);
		border-right: 1px solid color-mix(in srgb, var(--color-text) 50%, transparent);
	}

	.resultado-controles {
		display: flex;
		align-items: center;
		gap: calc(var(--grid) * 1);
	}

	.resultado-filtros {
		display: flex;
		align-items: center;
		gap: calc(var(--grid) * 1);
		margin: calc(var(--grid) * 1) 0 calc(var(--grid) * 1.5);
		flex-wrap: wrap;
	}


	.resultado-status {
		color: var(--color-text-subtle);
		font-size: calc(var(--grid) * 1.5);
	}

	.resultado-icon {
		width: 10px;
		height: 10px;
		fill: currentColor;
	}

	.resultado-icon--next {
		transform: rotate(180deg);
	}

	.resultado-graficos {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: calc(var(--grid) * 3);
	}

	.resultado-graficos-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(260px, 1fr));
		gap: calc(var(--grid) * 15);
		width: 100%;
	}

	@media (max-width: 640px) {
		.resultado-graficos-grid {
			grid-template-columns: 1fr;
		}
	}

	.resultado-graficos-toggle {
		align-self: center;
		margin-top: 0;
		padding: 6px 14px;
		border-radius: 20px;
		border: 1px solid var(--color-dark);
		background: var(--color-tertiary);
		color: var(--color-dark);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}

	.resultado-graficos-toggle:hover {
		background: var(--color-dark);
		color: var(--color-tertiary);
	}
</style>
