<script>
	import { onMount } from 'svelte';
	import { format, parseISO } from 'date-fns';
	import ptBR from 'date-fns/locale/pt-BR';
	import { base } from '$app/paths';
	import VotesSearch from './components/VotesSearch.svelte';
	import Button from './components/ui/Button.svelte';
	import Select from './components/ui/Select.svelte';
	import BubbleChart from './components/BubbleChart.svelte';
	import Hemiciclo from './components/Hemiciclo.svelte';
	import PartidosDivergente from './components/PartidosDivergente.svelte';
	import MapaUF from './components/MapaUF.svelte';
	import { reveal, countUp } from '$lib/motion.js';
	import { CADEIRAS_UF } from '$lib/votos.js';
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
	const resumoVazio = {
		sim: 0,
		nao: 0,
		abstencao: 0,
		obstrucao: 0,
		ausentes: 0,
		total: 0,
		totalGeral: 0
	};
	let resumoVotos = { ...resumoVazio };
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
	let mostrarTabela = false;

	$: votosExibidos = votosComAusentes
		.filter((voto) => (filtroVoto ? voto.tipoVoto === filtroVoto : true))
		.filter((voto) => (filtroEstado ? voto?.deputado_?.siglaUf === filtroEstado : true))
		.filter((voto) => (filtroPartido ? voto?.deputado_?.siglaPartido === filtroPartido : true))
		.filter((voto) =>
			filtroNome
				? voto?.deputado_?.nome?.toLowerCase?.().includes(filtroNome.trim().toLowerCase())
				: true
		);

	$: votosFiltradosBase = votosComAusentes
		.filter((voto) => (filtroEstado ? voto?.deputado_?.siglaUf === filtroEstado : true))
		.filter((voto) => (filtroPartido ? voto?.deputado_?.siglaPartido === filtroPartido : true));

	$: if (votosRegistrados.length === 0) {
		resumoVotos = { ...resumoVazio };
	} else {
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
		const totalGeral = 513;
		const ausentes = Math.max(0, totalGeral - total);
		resumoVotos = { sim, nao, abstencao, obstrucao, ausentes, total, totalGeral };
	}

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
		...Array.from(
			new Set(votosComAusentes.map((voto) => voto?.deputado_?.siglaPartido).filter(Boolean))
		)
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
	$: fimTextoCurto =
		votos.length > 0
			? format(votos[0].dataRegistroVoto, "dd/MM/yy, 'às' HH:mm", { locale: ptBR })
			: '';

	$: ultimaAtualizacaoTexto = ultimaAtualizacao
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

	// The legislature file lists everyone who served (substitutes included), so absentees
	// are capped per state at its fixed number of seats; the plenary always adds up to 513.
	$: votosComAusentes = (() => {
		if (!deputadosLegislatura.length) return votosRegistrados;
		const idsVotaram = new Set(votosRegistrados.map((voto) => voto?.deputado_?.id).filter(Boolean));
		const dataRegistro = votosRegistrados[0]?.dataRegistroVoto ?? null;
		const vagas = { ...CADEIRAS_UF };
		for (const v of votosRegistrados) {
			const uf = v?.deputado_?.siglaUf;
			if (uf in vagas) vagas[uf] -= 1;
		}
		const ausentes = [];
		for (const dep of deputadosLegislatura) {
			if (!dep?.id || idsVotaram.has(dep.id) || !(vagas[dep.siglaUf] > 0)) continue;
			idsVotaram.add(dep.id);
			vagas[dep.siglaUf] -= 1;
			ausentes.push({ tipoVoto: 'Ausentes', dataRegistroVoto: dataRegistro, deputado_: dep });
		}
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

	let pedidoVotos = 0;

	async function fetchVotos() {
		const pedido = ++pedidoVotos;
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
			if (pedido !== pedidoVotos) return;
			const lista = Array.isArray(data?.votos) ? data.votos : [];
			if (lista.length === 0) {
				erroVotos = '';
				votos = [];
				votosRegistrados = [];
				resumoVotos = { ...resumoVazio };
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
			if (pedido !== pedidoVotos) return;
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
			const totalGeral = 513;
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
			resumoVotos = { ...resumoVazio };
			resumoTexto = '';
		} finally {
			if (pedido === pedidoVotos) carregandoVotos = false;
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
			if (listaVotacoes.length > 0) {
				const alvo = selecionadoIndex >= 0 ? listaVotacoes[selecionadoIndex] : listaVotacoes[0];
				selecionarVotacao(alvo);
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

	function getNavStatus(lista, indice) {
		if (lista.length === 0) return '0/0';
		const atual = indice >= 0 ? indice + 1 : 0;
		return `${atual}/${lista.length}`;
	}

	$: if (listaVotacoes.length > 0 && votacaoId) {
		const idx = listaVotacoes.findIndex((item) => String(item.id) === String(votacaoId));
		if (idx !== -1 && idx !== selecionadoIndex) {
			selecionadoIndex = idx;
		}
	}

	$: navStatus = getNavStatus(listaVotacoes, selecionadoIndex);
	$: temVotacao = Boolean(votacaoId);
	$: temResultados = resumoVotosGrafico?.totalGeral > 0;
	$: temLista = listaVotacoes.length > 0;

	function limparLista() {
		listaVotacoes = [];
		selecionadoIndex = -1;
		votacaoId = '';
		dataInicio = '';
		votos = [];
		votosRegistrados = [];
		deputadosLegislatura = [];
		resumoVotos = { ...resumoVazio };
		resumoTexto = '';
		erroVotos = '';
		filtroVoto = '';
		filtroEstado = '';
		filtroPartido = '';
		filtroNome = '';
	}

	$: votoAtual = selecionadoIndex >= 0 ? listaVotacoes[selecionadoIndex] : null;
	$: descricaoAtual = (votoAtual?.descricao || '').replace(/\s*(Sim|Não|Abstenç[ãa]o|Obstruç[ãa]o|Total):\s*\d+;?\.?/gi, '').trim();
	$: votosBaseEstado = votosComAusentes.filter((v) => (filtroEstado ? v?.deputado_?.siglaUf === filtroEstado : true));
	$: votosBasePartido = votosComAusentes.filter((v) => (filtroPartido ? v?.deputado_?.siglaPartido === filtroPartido : true));
	$: filtrosAtivos = [filtroVoto, filtroPartido, filtroEstado, filtroNome].filter(Boolean);

	function limparFiltros() {
		filtroVoto = '';
		filtroEstado = '';
		filtroPartido = '';
		filtroNome = '';
	}

	function aoTeclar(event) {
		const alvo = event.target;
		if (alvo?.closest?.('input, select, textarea, [contenteditable]')) return;
		if (!temLista || event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === 'ArrowRight' && selecionadoIndex < listaVotacoes.length - 1) {
			selecionarPorIndice(selecionadoIndex + 1, 1);
		} else if (event.key === 'ArrowLeft' && selecionadoIndex > 0) {
			selecionarPorIndice(selecionadoIndex - 1, -1);
		}
	}

	onMount(() => {
		carregarIndices();
		carregarComponentesResultados();
	});
</script>

<svelte:window on:keydown={aoTeclar} />

<header class="hero">
	<p class="ds-label hero-in" style="--d:0ms">Câmara dos Deputados · dados abertos</p>
	<h1 class="hero-title hero-in" style="--d:80ms">Voto a voto</h1>
	<p class="hero-lead hero-in" style="--d:180ms">
		Cada votação nominal do plenário, deputado por deputado. Os dados vêm da API oficial da
		Câmara e são atualizados todos os dias.
	</p>
	<dl class="hero-stats hero-in" style="--d:280ms">
		<div><dt>votações nominais</dt><dd use:countUp={votosDisponiveis.size}>0</dd></div>
		<div><dt>meses com votação</dt><dd use:countUp={opcoesMes.length}>0</dd></div>
		<div><dt>cadeiras no plenário</dt><dd use:countUp={513}>0</dd></div>
	</dl>
	{#if ultimaAtualizacaoTexto}
		<p class="hero-update hero-in" style="--d:360ms">
			<span class="pulse" aria-hidden="true" />
			<time datetime={ultimaAtualizacao}>Atualizado em {ultimaAtualizacaoTexto}</time>
		</p>
	{/if}
</header>

{#if VotesSummaryComponent}
	<div class="barra">
		<div class="barra-inner">
			<svelte:component
				this={VotesSummaryComponent}
				{votacaoId}
				{resumoTexto}
				resumoVotos={resumoVotosGrafico}
				{filtroVoto}
				{fimTexto}
				{fimTextoCurto}
				temMes={Boolean(dataInicio)}
				on:filterChange={(event) => atualizarFiltro(event.detail.tipo)}
			>
				<div class="resultado-nav">
					{#if temLista && temVotacao}
						<Button
							size="small"
							shape="circle"
							on:click={() => selecionarPorIndice(selecionadoIndex - 1, -1)}
							disabled={selecionadoIndex <= 0}
							aria-label="Votação anterior"
						>
							<svg class="seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
						</Button>
						<span class="resultado-status" aria-live="polite">
							<b>{selecionadoIndex + 1}</b>/{listaVotacoes.length}
						</span>
						<Button
							size="small"
							shape="circle"
							on:click={() => selecionarPorIndice(selecionadoIndex + 1, 1)}
							disabled={selecionadoIndex < 0 || selecionadoIndex >= listaVotacoes.length - 1}
							aria-label="Próxima votação"
						>
							<svg class="seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
						</Button>
					{/if}
				</div>
				<div class="resultado-filtros" slot="filters">
					<VotesSearch
						bind:dataInicio
						{carregandoLista}
						{erroLista}
						{listaVotacoes}
						{opcoesMes}
						onListar={fetchListaVotacoes}
						onSelect={selecionarVotacao}
						inline={true}
						showStatus={false}
					/>
					{#if temResultados}
						<Select
							bind:value={filtroNome}
							options={[
								{ value: '', label: 'Todos os deputados' },
								...Array.from(new Set(votosComAusentes.map((v) => v?.deputado_?.nome).filter(Boolean)))
									.sort()
									.map((nome) => ({ value: nome, label: nome }))
							]}
							placeholder=""
							aria-label="Filtrar por deputado"
						/>
						<Select bind:value={filtroEstado} options={opcoesEstado} placeholder="" aria-label="Filtrar por estado" />
						<Select bind:value={filtroPartido} options={opcoesPartido} placeholder="" aria-label="Filtrar por partido" />
						{#if filtrosAtivos.length}
							<button type="button" class="limpar" on:click={limparFiltros}>
								Limpar filtros <span>{filtrosAtivos.length}</span>
							</button>
						{/if}
					{/if}
				</div>
			</svelte:component>
			{#if erroLista}<p class="erro">{erroLista}</p>{/if}
		</div>
	</div>
{/if}

<main class="conteudo">
	{#if !votosIndexOk}
		<p class="erro">Dados locais incompletos. Rode <code>npm run fetch:data</code>.</p>
	{/if}
	{#if erroVotos}<p class="erro">{erroVotos}</p>{/if}

	{#if !dataInicio}
		<section class="vazio" use:reveal>
			<p class="ds-label">Para começar</p>
			<h2 class="sec-title">Escolha um mês</h2>
			<p class="sec-lead">Use o seletor acima. A votação mais recente do mês abre logo em seguida.</p>
			{#if opcoesMes.length}
				<div class="atalhos">
					{#each opcoesMes.slice(0, 6) as mes}
						<button type="button" class="atalho" on:click={() => (dataInicio = mes.value)}>{mes.label}</button>
					{/each}
				</div>
			{/if}
		</section>
	{:else if votos.length === 0 && (carregandoVotos || carregandoLista)}
		<div class="carregando" aria-live="polite">
			<span /><span /><span />
			<p>Buscando votos</p>
		</div>
	{/if}
	{#if dataInicio && votos.length > 0}
	<div class="resultados" class:resultados--carregando={carregandoVotos} aria-busy={carregandoVotos}>
		{#key votacaoId}
			<section class="sec sec--abre">
				<p class="ds-label">Em votação · {fimTexto}</p>
				{#if resumoTexto}
					<h2 class="sec-title sec-title--ementa">{resumoTexto}</h2>
				{/if}
				{#if descricaoAtual}
					<p class="sec-lead">{descricaoAtual}</p>
				{/if}
			</section>
		{/key}

		<section class="sec" use:reveal>
			<hr class="regua" />
			<p class="ds-label">01 · Plenário</p>
			<h2 class="sec-title">Como as 513 cadeiras votaram</h2>
			<p class="sec-lead">Cada ponto é um deputado. Toque ou passe o cursor para ver quem é; o toque também filtra a página.</p>
			<div class="figura">
				<Hemiciclo
					votos={votosComAusentes}
					chave={votacaoId}
					{filtroVoto}
					{filtroEstado}
					{filtroPartido}
					{filtroNome}
					on:tipo={(e) => atualizarFiltro(e.detail)}
					on:deputado={(e) => (filtroNome = filtroNome === e.detail ? '' : e.detail)}
				/>
			</div>
		</section>

		<div class="duas">
			<section class="sec" use:reveal>
				<hr class="regua" />
				<p class="ds-label">02 · Partidos</p>
				<h2 class="sec-title">Do mais a favor ao mais contra</h2>
				<p class="sec-lead">Não à esquerda, sim à direita. Clique num partido para filtrar o resto da página.</p>
				<PartidosDivergente
					votos={votosBaseEstado}
					chave={votacaoId}
					selecionado={filtroPartido}
					on:partido={(e) => (filtroPartido = e.detail)}
				/>
			</section>

			<section class="sec" use:reveal={{ delay: 120 }}>
				<hr class="regua" />
				<p class="ds-label">03 · Estados</p>
				<h2 class="sec-title">O voto pelo mapa</h2>
				<p class="sec-lead">Percentual de sim entre quem votou sim ou não, por bancada estadual.</p>
				<MapaUF
					votos={votosBasePartido}
					chave={votacaoId}
					selecionado={filtroEstado}
					on:estado={(e) => (filtroEstado = e.detail)}
				/>
			</section>
		</div>

		<section class="sec" use:reveal>
			<hr class="regua" />
			<p class="ds-label">04 · Bolhas</p>
			<h2 class="sec-title">O peso de cada bancada</h2>
			<div class="bolhas">
				<BubbleChart title="Por partido" items={dadosPorPartido} layoutMode={layoutBolhas} />
				<BubbleChart title="Por estado" items={dadosPorEstado} layoutMode={layoutBolhas} />
			</div>
			<div class="acoes">
				<Button size="small" on:click={() => (layoutBolhas = layoutBolhas === 'pack' ? 'stack' : 'pack')}>
					{layoutBolhas === 'pack' ? 'Separar por voto' : 'Juntar de novo'}
				</Button>
			</div>
		</section>

		<section class="sec" use:reveal>
			<hr class="regua" />
			<p class="ds-label">05 · Deputados</p>
			<h2 class="sec-title">Voto a voto, nome a nome</h2>
			<p class="sec-lead">{votosExibidos.length.toLocaleString('pt-BR')} deputados com os filtros atuais.</p>
			{#if VotesTableComponent}
				<svelte:component this={VotesTableComponent} votos={votosExibidos} />
			{/if}
		</section>
	</div>
	{/if}
</main>

<footer class="rodape">
	<hr class="regua" />
	<p>
		Fonte: <a href="https://dadosabertos.camara.leg.br" target="_blank" rel="noreferrer">Dados Abertos da Câmara dos Deputados</a>.
		Só entram votações nominais, com placar registrado.
	</p>
</footer>

<style>
	.hero,
	.conteudo,
	.rodape,
	.barra-inner {
		width: calc(100% - var(--grid) * 4);
		max-width: var(--w-page);
		margin: 0 auto;
	}

	.hero {
		padding: calc(var(--grid) * 12) 0 calc(var(--grid) * 6);
		max-width: 875px;
	}

	.hero-in {
		animation: settle 600ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: var(--d);
	}

	@keyframes settle {
		from {
			opacity: 0;
			transform: translateY(28px);
		}
	}

	.hero-title {
		font-size: clamp(calc(var(--grid) * 6), 11vw, calc(var(--grid) * 13));
		line-height: 0.95;
		letter-spacing: -0.03em;
		margin: 0 0 calc(var(--grid) * 3);
	}

	.hero-lead {
		font-size: calc(var(--grid) * 3);
		font-weight: 300;
		line-height: 1.45;
		letter-spacing: -0.02em;
		max-width: 720px;
		margin: 0 0 calc(var(--grid) * 5);
	}

	.hero-stats {
		display: flex;
		flex-wrap: wrap;
		gap: calc(var(--grid) * 2) calc(var(--grid) * 6);
		margin: 0 0 calc(var(--grid) * 4);
		padding-top: calc(var(--grid) * 2);
		border-top: 2px solid var(--color-dark);
	}

	.hero-stats div {
		display: flex;
		flex-direction: column-reverse;
	}

	.hero-stats dd {
		margin: 0;
		font-family: var(--font-display);
		font-size: calc(var(--grid) * 5.5);
		line-height: 1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}

	.hero-stats dt {
		font-size: var(--t-caption);
		color: var(--color-text-muted);
		margin-top: calc(var(--grid) * 0.6);
	}

	.hero-update {
		display: flex;
		align-items: center;
		gap: calc(var(--grid) * 1);
		font-size: var(--t-caption);
		color: var(--color-text-muted);
		margin: 0;
	}

	.pulse {
		position: relative;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--vote-sim);
	}

	.pulse::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: var(--vote-sim);
		animation: pulse 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
	}

	@keyframes pulse {
		from {
			transform: scale(1);
			opacity: 0.6;
		}
		to {
			transform: scale(3.2);
			opacity: 0;
		}
	}

	.barra {
		position: sticky;
		top: 0;
		z-index: 20;
		background: color-mix(in srgb, var(--color-light) 88%, transparent);
		backdrop-filter: blur(14px) saturate(1.4);
		-webkit-backdrop-filter: blur(14px) saturate(1.4);
		border-top: 2px solid var(--color-dark);
		border-bottom: 1px solid var(--color-rule);
	}

	.resultado-nav {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--grid) * 1);
		flex-shrink: 0;
	}

	@media (max-width: 600px) {
		.resultado-nav {
			gap: 2px;
		}

		.resultado-status {
			min-width: 5ch;
		}
	}

	.resultado-status {
		font-size: var(--t-label);
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);
		min-width: 6ch;
		text-align: center;
		white-space: nowrap;
	}

	.resultado-status b {
		color: var(--color-dark);
		font-weight: 600;
	}

	.resultados {
		transition: opacity 360ms var(--ease);
	}

	.resultados--carregando {
		opacity: 0.45;
		pointer-events: none;
	}

	.seta {
		width: 14px;
		height: 14px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.resultado-filtros {
		display: flex;
		align-items: center;
		gap: calc(var(--grid) * 0.8);
		flex-wrap: wrap;
	}

	.limpar {
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-label);
		font-weight: 500;
		color: var(--color-dark);
		cursor: pointer;
		padding: calc(var(--grid) * 0.6) calc(var(--grid) * 0.4);
		text-decoration: underline 2px var(--color-primary);
		text-underline-offset: 5px;
		animation: settle 360ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.limpar span {
		display: inline-grid;
		place-items: center;
		min-width: 18px;
		height: 18px;
		margin-left: 4px;
		border-radius: 999px;
		background: var(--color-primary);
		color: var(--color-on-primary);
		font-size: 11px;
		text-decoration: none;
	}

	.conteudo {
		padding-bottom: calc(var(--grid) * 8);
	}

	.sec {
		margin-top: calc(var(--grid) * 8);
	}

	.sec--abre {
		max-width: 875px;
		animation: settle 600ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
	}

	.regua {
		border: 0;
		border-top: 2px solid var(--color-dark);
		margin: 0 0 calc(var(--grid) * 3);
		transform-origin: left;
		animation: draw 900ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
	}

	@keyframes draw {
		from {
			transform: scaleX(0);
		}
	}

	.sec-title {
		font-size: calc(var(--grid) * 3.4);
		line-height: 1.12;
		margin: 0 0 calc(var(--grid) * 1.5);
		max-width: 760px;
	}

	.sec-title--ementa {
		font-size: calc(var(--grid) * 3.6);
		line-height: 1.18;
	}

	.sec-lead {
		font-size: var(--t-body);
		color: var(--color-text-muted);
		max-width: var(--w-text);
		margin: 0 0 calc(var(--grid) * 4);
	}

	.figura {
		max-width: 980px;
		margin: 0 auto;
	}

	.duas {
		display: grid;
		grid-template-columns: 1.15fr 1fr;
		gap: 0 calc(var(--grid) * 8);
		align-items: start;
	}

	.bolhas {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: calc(var(--grid) * 6);
	}

	.acoes {
		display: flex;
		justify-content: center;
		margin-top: calc(var(--grid) * 2);
	}

	.vazio {
		margin-top: calc(var(--grid) * 6);
		padding: calc(var(--grid) * 4) 0;
	}

	.atalhos {
		display: flex;
		flex-wrap: wrap;
		gap: calc(var(--grid) * 1);
	}

	.atalho {
		border: 1px solid var(--color-dark);
		border-radius: 999px;
		background: none;
		color: var(--color-dark);
		font: inherit;
		font-size: var(--t-label);
		font-weight: 500;
		padding: calc(var(--grid) * 0.9) calc(var(--grid) * 1.8);
		cursor: pointer;
		transition: background-color 180ms var(--ease), color 180ms var(--ease), transform 180ms var(--ease);
	}

	.atalho:hover {
		background: var(--color-dark);
		color: var(--color-light);
		transform: translateY(-2px);
	}

	.carregando {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: calc(var(--grid) * 10) 0;
		justify-content: center;
		color: var(--color-text-muted);
	}

	.carregando span {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--vote-sim);
		animation: bounce 900ms cubic-bezier(0.2, 0.8, 0.2, 1) infinite alternate;
	}

	.carregando span:nth-child(2) {
		background: var(--vote-abstencao);
		animation-delay: 150ms;
	}

	.carregando span:nth-child(3) {
		background: var(--vote-nao);
		animation-delay: 300ms;
	}

	.carregando p {
		margin: 0 0 0 calc(var(--grid) * 1);
		font-size: var(--t-caption);
	}

	@keyframes bounce {
		to {
			transform: translateY(-10px);
			opacity: 0.4;
		}
	}

	.erro {
		color: var(--color-danger);
		font-size: var(--t-caption);
		margin: calc(var(--grid) * 2) 0;
	}

	.rodape {
		padding-bottom: calc(var(--grid) * 6);
		font-size: var(--t-caption);
		color: var(--color-text-muted);
	}

	.rodape a {
		color: var(--color-dark);
		font-weight: 600;
		text-decoration: none;
		transition: color 180ms var(--ease);
	}

	.rodape a:hover {
		color: var(--color-primary);
		text-decoration: underline 2px;
		text-underline-offset: 4px;
	}

	@media (max-width: 900px) {
		.duas,
		.bolhas {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 600px) {
		.hero {
			padding-top: calc(var(--grid) * 7);
		}

		/* One scrolling row of filters keeps the sticky bar short on a phone */
		.resultado-filtros {
			flex-wrap: nowrap;
			overflow-x: auto;
			scrollbar-width: none;
			margin: 0 calc(var(--grid) * -2);
			padding: 2px calc(var(--grid) * 2);
			scroll-snap-type: x proximity;
			scroll-padding-inline: calc(var(--grid) * 2);
			-webkit-mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 24px), transparent);
			mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 24px), transparent);
		}

		.resultado-filtros::-webkit-scrollbar {
			display: none;
		}

		.resultado-filtros > :global(*) {
			flex: 0 0 auto;
			scroll-snap-align: start;
		}

		.hero-lead {
			font-size: calc(var(--grid) * 2.3);
		}

		.hero-stats dd {
			font-size: calc(var(--grid) * 4.2);
		}

		.sec-title {
			font-size: calc(var(--grid) * 2.6);
		}

		.sec-title--ementa {
			font-size: calc(var(--grid) * 2.6);
		}

		.sec {
			margin-top: calc(var(--grid) * 6);
		}
	}
</style>
