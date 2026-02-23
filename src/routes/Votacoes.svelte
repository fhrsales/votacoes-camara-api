<script>
	import { onDestroy, onMount, tick } from 'svelte';
	import { format, parseISO } from 'date-fns';
	import ptBR from 'date-fns/locale/pt-BR';
	import { base } from '$app/paths';
	import VotesSearch from './components/VotesSearch.svelte';
	import Button from './components/ui/Button.svelte';
	import Select from './components/ui/Select.svelte';
	import BubbleChart from './components/BubbleChart.svelte';
	import Swiper from 'swiper';
import { EffectFade, Pagination } from 'swiper/modules';
	import 'swiper/css';
	import 'swiper/css/effect-fade';
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
	let swiperEl;
	let summaryEl;
	let secondScreenEl;
	let swiperInstance;
	let temGraficos = false;
	let mostrarHero = true;
	let heroHiding = false;

	function ajustarAlturaViewport() {
		if (typeof window === 'undefined') return;
		const altura = window.innerHeight * 0.01;
		document.documentElement.style.setProperty('--vh', `${altura}px`);
	}

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
		const totalGeral = deputadosLegislatura.length || 513;
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
			resumoVotos = { ...resumoVazio };
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

	function irParaSlide(indice) {
		if (!swiperInstance) return;
		swiperInstance.slideTo(indice);
	}

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

	function criarSwiper() {
		if (!swiperEl) return;
		const alturaViewport = () => {
			const alturaJanela = Math.round(window.innerHeight || 0);
			const alturaResumo = summaryEl?.offsetHeight || 0;
			return Math.max(0, alturaJanela - alturaResumo);
		};
		const atualizarAltura = () => {
			const altura = alturaViewport();
			if (!altura) return;
			swiperInstance.params.height = altura;
			swiperInstance.height = altura;
			swiperEl.style.height = `${altura}px`;
		};
		swiperInstance = new Swiper(swiperEl, {
			modules: [Pagination, EffectFade],
			direction: 'vertical',
			slidesPerView: 1,
			speed: 700,
			spaceBetween: 0,
			loop: false,
			effect: 'fade',
			fadeEffect: { crossFade: true },
			watchOverflow: true,
			allowTouchMove: false,
			mousewheel: false,
			pagination: false,
			resistanceRatio: 0.7,
			threshold: 15,
			observeParents: true,
			observer: true,
			autoHeight: false,
			height: alturaViewport()
		});
		swiperEl.style.height = `${alturaViewport()}px`;
		const aoResize = () => {
			atualizarAltura();
			swiperInstance.update();
		};
		window.addEventListener('resize', aoResize);
		window.addEventListener('orientationchange', aoResize);
		swiperInstance.on('destroy', () => {
			window.removeEventListener('resize', aoResize);
			window.removeEventListener('orientationchange', aoResize);
		});
		atualizarAltura();
		swiperInstance.update();
		// pagination disabled
		requestAnimationFrame(() => {
			atualizarAltura();
			swiperInstance.update();
			// pagination disabled
		});
		setTimeout(() => {
			atualizarAltura();
			swiperInstance.update();
			// pagination disabled
		}, 300);
	}

	function destruirSwiper() {
		if (swiperInstance) {
			swiperInstance.destroy(true, true);
			swiperInstance = null;
		}
	}

	onMount(() => {
		carregarIndices();
		carregarComponentesResultados();
		ajustarAlturaViewport();
		window.addEventListener('resize', ajustarAlturaViewport);
		window.addEventListener('orientationchange', ajustarAlturaViewport);
		let ticking = false;
		const checarHero = () => {
			if (!mostrarHero || !secondScreenEl) return;
			const topoSecond = secondScreenEl.getBoundingClientRect().top;
			if (topoSecond <= 0) {
				heroHiding = true;
				setTimeout(() => {
					mostrarHero = false;
					heroHiding = false;
					window.scrollTo({ top: 0, behavior: 'smooth' });
				}, 260);
			}
		};
		const aoScroll = () => {
			if (ticking) return;
			ticking = true;
			requestAnimationFrame(() => {
				checarHero();
				ticking = false;
			});
		};
		window.addEventListener('scroll', aoScroll, { passive: true });
		requestAnimationFrame(checarHero);
		criarSwiper();
		return () => {
			window.removeEventListener('resize', ajustarAlturaViewport);
			window.removeEventListener('orientationchange', ajustarAlturaViewport);
			window.removeEventListener('scroll', aoScroll);
		};
	});

	onDestroy(() => {
		if (swiperInstance) swiperInstance.destroy(true, true);
	});

	$: if (swiperInstance) {
		if (summaryEl) {
			const altura = Math.max(0, Math.round(window.innerHeight || 0) - summaryEl.offsetHeight);
			if (altura) {
				swiperInstance.params.height = altura;
				swiperInstance.height = altura;
				swiperEl.style.height = `${altura}px`;
			}
		}
		swiperInstance.update();
		// pagination disabled
	}

	$: if ((votos.length > 0) !== temGraficos) {
		temGraficos = votos.length > 0;
		tick().then(() => {
			destruirSwiper();
			criarSwiper();
		});
	}
</script>

{#if mostrarHero}
	<div class={`page-hero ${heroHiding ? 'page-hero--hide' : ''}`}>
		<div class="hero">
			<h1 class="pagina-titulo">Voto a Voto: Monitorando a Democracia em Tempo Real</h1>
			<h2>
				Monitoramento e análise dos dados de votação da API oficial da Câmara dos Deputados, acompanhando todas as votações realizadas desde outubro de 2022
			</h2>
			{#if ultimaAtualizacaoTexto}
				<time class="atualizacao" datetime={ultimaAtualizacao}>
					Atualizado em {ultimaAtualizacaoTexto}
				</time>
			{/if}
		</div>
	</div>
{/if}

<div class="second-screen" bind:this={secondScreenEl}>
{#if VotesSummaryComponent}
	<div class="page-section" bind:this={summaryEl}>
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
				{#if temResultados}
					<div class="resultado-total">Total de votos: {resumoVotosGrafico.total}</div>
				{/if}
				<div class="resultado-controles">
					{#if temLista && temVotacao}
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
								<path
									d="M685.248 104.704a64 64 0 0 1 0 90.496L368.448 512l316.8 316.8a64 64 0 0 1-90.496 90.496L232.704 557.248a64 64 0 0 1 0-90.496l362.048-362.048a64 64 0 0 1 90.496 0z"
								/>
							</svg>
						</Button>
						<span class="resultado-status">{navStatus}</span>
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
								<path
									d="M685.248 104.704a64 64 0 0 1 0 90.496L368.448 512l316.8 316.8a64 64 0 0 1-90.496 90.496L232.704 557.248a64 64 0 0 1 0-90.496l362.048-362.048a64 64 0 0 1 90.496 0z"
								/>
							</svg>
						</Button>
					{/if}
				</div>
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
							...Array.from(
								new Set(
									votosComAusentes
										.map((voto) => voto?.deputado_?.nome)
										.filter(Boolean)
								)
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
				{/if}
			</div>
		</svelte:component>
		{#if erroLista}
			<p class="erro">{erroLista}</p>
		{/if}
		{#if carregandoLista}
			<p>Buscando votações...</p>
		{/if}
	</div>
{/if}

<div class="swiper" bind:this={swiperEl}>
	<div class="swiper-wrapper">
		<section class="swiper-slide">
			<div class="slide-content">
				{#if !votosIndexOk}
					<p class="erro">Dados locais incompletos. Rode <code>npm run fetch:data</code>.</p>
				{/if}
				{#if erroVotos}
					<p class="erro">{erroVotos}</p>
				{/if}

				{#if carregandoVotos}
					<p>Buscando votos...</p>
				{:else if votos.length > 0}
					{#if VotesTableComponent}
						<svelte:component
							this={VotesTableComponent}
							votos={votosExibidos}
							onShowGraficos={() => irParaSlide(1)}
						/>
					{/if}
				{:else}
					<p />
				{/if}
			</div>
		</section>

		{#if votos.length > 0}
			<section class="swiper-slide">
				<div class="slide-content slide-content--charts">
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
						<div class="resultado-graficos-actions">
							<Button
								size="small"
								variant="primary"
								on:click={() => (layoutBolhas = layoutBolhas === 'pack' ? 'stack' : 'pack')}
							>
								{layoutBolhas === 'pack' ? 'Agrupar' : 'Desagrupar'}
							</Button>
							<Button size="small" variant="primary" on:click={() => irParaSlide(0)}>
								Ver tabela
							</Button>
						</div>
					</div>
				</div>
			</section>
		{/if}
	</div>
</div>
</div>

<style>
	.page-hero {
		width: 100%;
		max-width: calc(var(--grid) * 110);
		margin: 0 auto;
		padding: calc(var(--grid) * 2);
		box-sizing: border-box;
		height: calc(var(--vh, 1vh) * 100) !important;
		min-height: calc(var(--vh, 1vh) * 100) !important;
		display: flex;
		flex-direction: column;
		transition: opacity 220ms ease, transform 220ms ease;
	}

	.page-hero--hide {
		opacity: 0;
		transform: translateY(-16px);
		pointer-events: none;
	}

	.page-section {
		width: 100%;
		max-width: calc(var(--grid) * 120);
		margin: 0 auto;
		/* padding: 0 calc(var(--grid) * 2) calc(var(--grid) * 2); */
		box-sizing: border-box;
		position: sticky;
		top: 0;
		z-index: 5;
		background: var(--color-bg);
		/* padding-top: calc(var(--grid) * 2); */
		/* box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08); */
	}

	.second-screen {
		min-height: 100svh;
		min-height: calc(var(--vh, 1vh) * 100);
		height: 100svh;
		height: calc(var(--vh, 1vh) * 100);
		display: flex;
		flex-direction: column;
	}

	.slide-content {
		width: 100%;
		max-width: calc(var(--grid) * 120);
		margin: 0 auto;
		padding: calc(var(--grid) * 2);
		box-sizing: border-box;
		min-height: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.slide-content--charts {
		max-width: calc(var(--grid) * 120);
		padding: calc(var(--grid) * 1.5);
		overflow: hidden;
	}

	.swiper {
		height: 100%;
		width: 100%;
		flex: 1 1 auto;
		min-height: 0;
	}

	.swiper-wrapper {
		height: 100%;
	}

	.swiper-slide {
		height: 100%;
		display: flex;
		flex-direction: column;
	}


	.erro {
		color: var(--color-error);
		margin: calc(var(--grid) * 0.5) 0 calc(var(--grid) * 1.5);
		font-size: calc(var(--grid) * 1.5);
	}

	.pagina-titulo {
		margin: 0 0 calc(var(--grid) * 1.5);
		font-size: calc(var(--grid) * 3.5);
		line-height: calc(var(--grid) * 4.2);
		font-weight: 700;
	}

	.hero {
		flex: 1;
		min-height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: calc(var(--grid) * 1);
	}

	.hero :global(h1),
	.hero :global(h2),
	.hero .atualizacao {
		opacity: 0;
		transform: translateY(calc(var(--grid) * 3));
		animation: hero-fade-up 700ms ease-out forwards;
	}

	.hero :global(h1) {
		animation-delay: 0ms;
	}

	.hero :global(h2) {
		animation-delay: 220ms;
		margin: 0;
		font-size: calc(var(--grid) * 2);
		line-height: calc(var(--grid) * 3);
		font-weight: 400;
	}

	.hero .atualizacao {
		animation-delay: 440ms;
	}

	@keyframes hero-fade-up {
		from {
			opacity: 0;
			transform: translateY(calc(var(--grid) * 3));
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.atualizacao {
		display: block;
		margin: calc(var(--grid) * 0.8) 0 calc(var(--grid) * 1.5);
		color: var(--color-text-subtle);
		font-size: calc(var(--grid) * 1.4);
		line-height: calc(var(--grid) * 2.1);
		font-weight: 300;
		text-transform: uppercase;
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
		margin-top: calc(var(--grid) * 2);
		flex: 1 1 auto;
		min-height: 0;
		justify-content: space-between;
	}

	.resultado-graficos-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(260px, 1fr));
		gap: calc(var(--grid) * 6);
		width: 100%;
		flex: 1 1 auto;
		min-height: 0;
		align-content: start;
	}

	.resultado-graficos-actions {
		display: inline-flex;
		gap: calc(var(--grid) * 0.8);
		margin-top: calc(var(--grid) * 1.5);
		margin-bottom: calc(var(--grid) * 0.5);
	}

	@media (max-width: 640px) {
		.slide-content {
			padding: calc(var(--grid) * 1.5);
			padding-right: calc(var(--grid) * 2.5);
		}

		.pagina-titulo {
			font-size: calc(var(--grid) * 2.8);
			line-height: calc(var(--grid) * 3.2);
		}

		.hero :global(h2) {
			font-size: calc(var(--grid) * 1.8);
			line-height: calc(var(--grid) * 2.8);
		}

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
