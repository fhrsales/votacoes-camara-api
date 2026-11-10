<script>
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { format, parseISO } from 'date-fns';
	import ptBR from 'date-fns/locale/pt-BR/index.js';
	import { COR } from '$lib/votos.js';
	import { countUp, emVista, reveal } from '$lib/motion.js';
	import Navegacao from './Navegacao.svelte';

	export let data;
	/** 'camara' or 'senado': the same page serves deputies and senators */
	export let casa = 'camara';

	const CASAS = {
		camara: {
			rota: 'deputado',
			lista: 'deputados',
			Lista: 'Deputados',
			pasta: '',
			curta: 'Câmara',
			naCasa: 'na Câmara',
			masc: 'deputado',
			fem: 'deputada',
			umOuUma: 'deputado ou deputada',
			rotuloCargo: (C) => `${C} federal`,
			esquerda: 'PT, PSOL, PCdoB',
			direita: 'PL, NOVO',
			polos: 'PT e PSOL de um lado, PL e NOVO do outro',
			fonteVotos: 'API de Dados Abertos da Câmara',
			cotaNome: 'Cota para o Exercício da Atividade Parlamentar (CEAP), dados abertos da Câmara',
			notas: (id) => `https://www.camara.leg.br/deputados/${id}`,
			notasRotulo: 'Ver as notas na Câmara ↗',
			publica: 'A Câmara reembolsa e publica cada nota.'
		},
		senado: {
			rota: 'senador',
			lista: 'senadores',
			Lista: 'Senadores',
			pasta: '/senado',
			curta: 'Senado',
			naCasa: 'no Senado',
			masc: 'senador',
			fem: 'senadora',
			umOuUma: 'senador ou senadora',
			rotuloCargo: (C) => C,
			esquerda: 'PT',
			direita: 'PL',
			polos: 'PT de um lado, PL do outro',
			fonteVotos: 'API de Dados Abertos do Senado',
			cotaNome: 'Cota para o Exercício da Atividade Parlamentar dos Senadores (CEAPS), dados abertos do Senado',
			notas: (id) => `https://www6g.senado.leg.br/transparencia/sen/${id}/`,
			notasRotulo: 'Ver as notas no Senado ↗',
			publica: 'O Senado reembolsa e publica cada nota.'
		}
	};
	$: K = CASAS[casa];
	$: p = data.perfil;
	$: art = p.mulher ? 'a' : 'o';
	$: cargo = p.mulher ? K.fem : K.masc;
	$: Cargo = cargo.charAt(0).toUpperCase() + cargo.slice(1);

	// The rest of the chamber, for comparisons and the axis; not needed for the first paint
	let todos = [];
	onMount(async () => {
		try {
			const res = await fetch(`${base}/data${K.pasta}/perfis/index.json`);
			if (res.ok) todos = (await res.json()).deputados ?? [];
		} catch {
			todos = [];
		}
	});

	const media = (lista, campo) => {
		const v = lista.map((d) => d[campo]).filter((x) => x != null);
		return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
	};
	$: doPartido = todos.filter((d) => d.partido === p.partido);
	$: comp = {
		presenca: { camara: media(todos, 'presenca'), partido: media(doPartido, 'presenca') },
		governismo: { camara: media(todos, 'governismo'), partido: media(doPartido, 'governismo') },
		fidelidade: { camara: media(todos, 'fidelidade'), partido: media(doPartido, 'fidelidade') },
		eixo: { camara: media(todos, 'eixo'), partido: media(doPartido, 'eixo') }
	};

	const num = (v, casas = 0) =>
		v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
	const data_ = (iso, molde = "d 'de' MMM 'de' yyyy") => (iso ? format(parseISO(iso), molde, { locale: ptBR }) : '');

	// One plain sentence per measure, so the numbers read without the methodology
	function leituraGoverno(v) {
		if (v == null) return 'Ainda sem orientações do governo nas votações.';
		if (v >= 80) return 'Vota quase sempre com o governo.';
		if (v >= 60) return 'Acompanha o governo na maior parte das vezes.';
		if (v >= 40) return 'Divide-se entre governo e oposição.';
		if (v >= 20) return 'Vota mais contra o governo do que a favor.';
		return 'Vota quase sempre contra o governo.';
	}
	function leituraPartido(v) {
		if (v == null) return '';
		if (v >= 95) return 'Segue o partido quase sem exceção.';
		if (v >= 85) return 'Segue o partido na grande maioria das votações.';
		if (v >= 70) return 'Segue o partido, mas diverge com frequência.';
		return 'Vota com independência do partido.';
	}
	function leituraEixo(v) {
		if (v == null) return '';
		if (v <= 2) return `Vota como o bloco progressista (${K.esquerda}).`;
		if (v <= 4) return 'Fica no centro, mais perto do bloco progressista.';
		if (v < 6) return 'Fica no centro do plenário.';
		if (v < 8) return 'Fica no centro, mais perto do bloco conservador.';
		return `Vota como o bloco conservador (${K.direita}).`;
	}

	$: anos = Object.entries(p.anos ?? {});

	// Who they are, from the Câmara's own record
	$: bio = p.bio ?? null;
	$: idade = (() => {
		if (!bio?.nascimento) return null;
		const n = parseISO(bio.nascimento);
		const hoje = new Date();
		let a = hoje.getFullYear() - n.getFullYear();
		if (hoje < new Date(hoje.getFullYear(), n.getMonth(), n.getDate())) a -= 1;
		return a;
	})();
	const titulo = (s = '') =>
		s
			.toLowerCase()
			.replace(/(^|[\s-])([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase())
			.replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
	// Earlier terms in this house: Câmara legislatures, or Senado terms that ended by 2023
	$: anteriores =
		casa === 'senado'
			? (bio?.mandatos ?? []).filter((m) => m.ate && m.ate <= 2023)
			: (p.camara ?? []).filter((m) => m.ate < '2027');
	$: temTrajetoria = Boolean(bio && (bio.escolaridade || bio.profissoes?.length || bio.ocupacoes?.length || bio.mandatos?.length)) || anteriores.length > 0;
	const anosTxt = (de, ate) => (de ? (ate ? (ate === de ? `${de}` : `${de}–${ate}`) : `desde ${de}`) : '');
	const redeNome = (u) => {
		const h = u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
		if (h.includes('instagram')) return 'Instagram';
		if (h.includes('facebook')) return 'Facebook';
		if (h.includes('twitter') || h.includes('x.com')) return 'X';
		if (h.includes('youtube')) return 'YouTube';
		if (h.includes('tiktok')) return 'TikTok';
		return h;
	};
	// One-colour glyphs in the ink, like every other icon on the site
	const ICONES = {
		X: 'M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3zm-1.08 16.2h1.7L7.4 4.7H5.57l11.1 14.5z',
		Facebook: 'M14 8.5V6.8c0-.8.5-1.3 1.4-1.3H17V2.2C16.6 2.1 15.4 2 14.1 2 11.3 2 9.6 3.7 9.6 6.6v1.9H6.7V12h2.9v10H14V12h2.9l.4-3.5H14z',
		YouTube:
			'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z',
		TikTok: 'M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9a7.3 7.3 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z'
	};

	// Section numbers follow the sections actually shown
	$: secoes = [temTrajetoria && 'trajetoria', 'posicao', 'votos', p.divergencias?.length && 'contra', p.custos && 'custos'].filter(Boolean);
	$: numero = (nome) => String(secoes.indexOf(nome) + 1).padStart(2, '0');
	$: totalContagem = Object.values(p.contagem ?? {}).reduce((s, n) => s + n, 0) || 1;
	$: trocouPartido = (p.partidos ?? []).length > 1;

	// The axis: everyone as a faint dot, the party darker, this deputy marked. Drawn at the
	// real width of the column, so dots keep their size on a phone
	let largura = 900;
	$: W = Math.max(280, largura);
	const H = 150;
	const M = 12;
	$: xPos = (e) => M + (e / 10) * (W - 2 * M);
	const jitter = (id) => {
		const s = Math.sin(Number(id) * 12.9898) * 43758.5453;
		return s - Math.floor(s);
	};
	$: raio = W < 600 ? 3.5 : 5;
	$: pontos = todos.map((d) => ({
		d,
		x: xPos(d.eixo ?? 5),
		y: 34 + jitter(d.id) * 70,
		meu: d.partido === p.partido,
		eu: d.id === p.id
	}));

	// Tooltip on the dots: hover on a mouse; on a phone the first tap shows who it is and a
	// second tap on the same dot opens their page
	let foco = null;
	let ultimoPonteiro = 'mouse';
	function mostrar(pt) {
		foco = pt;
	}
	function esconder(event) {
		if (event?.pointerType === 'touch') return;
		foco = null;
	}
	function abrir(pt) {
		if (ultimoPonteiro !== 'mouse' && foco !== pt) {
			foco = pt;
			return;
		}
		goto(`${base}/${K.rota}/${pt.d.slug}`);
	}
	$: tipX = foco ? Math.min(Math.max(foco.x, 110), W - 110) : 0;

	// Arrow keys walk through the deputies, like the arrows at the top
	function teclas(event) {
		if (event.target.closest?.('input, select, textarea')) return;
		if (event.key === 'ArrowLeft') goto(`${base}/${K.rota}/${p.ordem.anterior.slug}`);
		if (event.key === 'ArrowRight') goto(`${base}/${K.rota}/${p.ordem.proximo.slug}`);
	}

	// Parliamentary quota (CEAP): reimbursed office, travel and publicity expenses
	$: custos = p.custos ?? null;
	const reais = (v, curto = false) => {
		if (v == null) return '—';
		if (curto && v >= 1e6) return `R$ ${num(v / 1e6, 1)} mi`;
		if (curto && v >= 1e5) return `R$ ${num(v / 1e3)} mil`;
		if (curto && v >= 1e3) return `R$ ${num(v / 1e3, 1)} mil`;
		return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
	};
	$: gastoCamara = media(todos.filter((d) => d.gasto), 'gasto');
	$: gastoUF = media(todos.filter((d) => d.gasto && d.uf === p.uf), 'gasto');
	$: posGasto = custos && todos.length ? todos.filter((d) => (d.gasto ?? 0) > custos.mediaMensal).length + 1 : null;
	$: totalGastadores = todos.filter((d) => d.gasto).length;
	$: maxMes = custos ? Math.max(...custos.meses.map(([, v]) => v)) : 1;
	$: categoriasTop = custos
		? (() => {
				const top = custos.categorias.slice(0, 6);
				const resto = custos.categorias.slice(6).reduce((s, c) => s + c.valor, 0);
				return resto > 0 ? [...top, { nome: 'Outros', valor: resto }] : top;
			})()
		: [];
	$: maxCat = categoriasTop[0]?.valor ?? 1;
	const mesCurto = (m) => format(parseISO(`${m}-01`), 'MMM/yy', { locale: ptBR });
	let focoMes = null;

	const limpa = (texto = '') => texto.replace(/\s*Sim:\s*\d+.*$/s, '').trim();
	let mostrarTodas = false;

	// Career timeline, oldest first; long ones (senators chair many fronts) open with the latest six
	let tempoTodo = false;
	$: linhaTempo = [...(bio?.mandatos ?? []).map((m) => ({ tipo: 'mandato', ...m })), ...(bio?.ocupacoes ?? []).map((o) => ({ tipo: 'ocupacao', ...o }))].sort(
		(x, y) => (x.de ?? 0) - (y.de ?? 0) || (x.ate ?? 9999) - (y.ate ?? 9999)
	);
	$: divergencias = mostrarTodas ? p.divergencias : p.divergencias.slice(0, 8);
	const corVoto = (v) => COR[v] ?? 'var(--color-dark)';
	// Light vote colours need dark text on the chip
	const claro = (v) => v === 'Abstenção' || v === 'Ausentes' || v === 'Não';
</script>

<svelte:head>
	<title>{p.nome} ({p.partido}-{p.uf}): como vota · Voto a voto</title>
	<meta
		name="description"
		content={`Como ${art} ${cargo} ${p.nome} (${p.partido}-${p.uf}) vota ${K.naCasa}: presença, alinhamento com o governo e com o partido, e onde fica entre progressistas e conservadores.`}
	/>
</svelte:head>

<svelte:window on:keydown={teclas} />

<div class="barra">
	<div class="barra-inner">
		<Navegacao {casa} secao="parlamentares">
		{#if p.ordem}
			<div class="passos">
				<a class="circulo" href={`${base}/${K.rota}/${p.ordem.anterior.slug}`} aria-label={`Anterior: ${p.ordem.anterior.nome}`} title={p.ordem.anterior.nome}>
					<svg class="seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
				</a>
				<span class="status"><b>{p.ordem.posicao}</b>/{p.ordem.total}</span>
				<a class="circulo" href={`${base}/${K.rota}/${p.ordem.proximo.slug}`} aria-label={`Próximo: ${p.ordem.proximo.nome}`} title={p.ordem.proximo.nome}>
					<svg class="seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
				</a>
			</div>
		{/if}
		</Navegacao>
	</div>
</div>

<main class="pagina">

	<!-- Who, in one compact block: the career details live in the Trajetória section -->
	<header class="cabeca">
		<span class="foto retrato entra"><img src={p.foto} alt="" width="120" height="120" /></span>
		<div class="quem">
			<p class="ds-label entra" style="--d:60ms">{K.rotuloCargo(Cargo)} · {p.uf}</p>
			<h1 class="entra-leve" style="--d:100ms">{p.nome}</h1>
			<p class="linha-id entra" style="--d:160ms">
				<span class="sigla-partido">{p.partido}</span>
				{#if trocouPartido}<span class="trocas">antes {p.partidos.slice(0, -1).map((x) => x.sigla).join(', ')}</span>{/if}
				<span>{num(p.votos)} votos · {data_(p.periodo.de, 'MMM yyyy')} a {data_(p.periodo.ate, 'MMM yyyy')}</span>
			</p>
		</div>
	</header>

	<!-- Four measures, each with a gauge: the bar is this person, the ticks are the house and the party -->
	<dl class="kpis entra aguarda-vista" style="--d:220ms" use:emVista>
		{#each [
			{ chave: 'presenca', rotulo: 'Presença', v: p.presenca, leitura: `Votou em ${num(p.votos)} de ${num(p.periodo.votacoes)} votações.` },
			{ chave: 'governismo', rotulo: 'Com o governo', v: p.governismo, leitura: leituraGoverno(p.governismo) },
			{ chave: 'fidelidade', rotulo: 'Com o partido', v: p.fidelidade, leitura: leituraPartido(p.fidelidade) }
		] as k, i}
			<div class="kpi">
				<dt>{k.rotulo}</dt>
				<dd class="numero">
					{#if k.v == null}—{:else}<span use:countUp={k.v}>{num(k.v)}</span><small>%</small>{/if}
				</dd>
				<dd class="medidor" aria-hidden="true">
					{#if k.v != null}<i class="cheio cresce-x" style={`width:${k.v}%;--i:${i};--d:300ms`} />{/if}
					{#if comp[k.chave].camara != null}<i class="marca-casa" style={`left:${comp[k.chave].camara}%`} />{/if}
					{#if comp[k.chave].partido != null}<i class="marca-partido" style={`left:${comp[k.chave].partido}%`} />{/if}
				</dd>
				<dd class="comp">
					{#if comp[k.chave].camara != null}<span><i class="tique tique--casa" />{K.curta} {num(comp[k.chave].camara)}%</span>{/if}
					{#if comp[k.chave].partido != null}<span><i class="tique tique--partido" />{p.partido} {num(comp[k.chave].partido)}%</span>{/if}
				</dd>
				<dd class="leitura">{k.leitura}</dd>
			</div>
		{/each}
		<div class="kpi">
			<dt>Posição no eixo</dt>
			<dd class="numero"><span use:countUp={[p.eixo ?? 0, 1]}>{num(p.eixo, 1)}</span><small>/10</small></dd>
			<dd class="medidor medidor--eixo" aria-hidden="true">
				{#if comp.eixo.camara != null}<i class="marca-casa" style={`left:${comp.eixo.camara * 10}%`} />{/if}
				{#if comp.eixo.partido != null}<i class="marca-partido" style={`left:${comp.eixo.partido * 10}%`} />{/if}
				<i class="ponto-eu aparece" style={`left:${(p.eixo ?? 5) * 10}%;--d:500ms`} />
			</dd>
			<dd class="comp">
				{#if comp.eixo.camara != null}<span><i class="tique tique--casa" />{K.curta} {num(comp.eixo.camara, 1)}</span>{/if}
				{#if comp.eixo.partido != null}<span><i class="tique tique--partido" />{p.partido} {num(comp.eixo.partido, 1)}</span>{/if}
			</dd>
			<dd class="leitura">{leituraEixo(p.eixo)}</dd>
		</div>
	</dl>

	{#if temTrajetoria}
		<section class="sec aguarda-vista" use:emVista use:reveal>
			<hr class="regua desenha" />
			<p class="ds-label">{numero('trajetoria')} · Trajetória</p>
			<h2>Quem é {p.nome}</h2>
			<div class="ficha">
				<dl class="dados">
					{#if bio?.nomeCivil}
						<div><dt>Nome civil</dt><dd>{titulo(bio.nomeCivil)}</dd></div>
					{/if}
					{#if bio?.nascimento}
						<div>
							<dt>Nascimento</dt>
							<dd>
								{data_(bio.nascimento, "d 'de' MMMM 'de' yyyy")}{#if bio.municipioNascimento}, {titulo(bio.municipioNascimento)}-{bio.ufNascimento}{/if}
							</dd>
						</div>
					{/if}
					{#if bio?.escolaridade}
						<div><dt>Escolaridade</dt><dd>{bio.escolaridade}</dd></div>
					{/if}
					{#if bio?.profissoes?.length}
						<div><dt>Profissão</dt><dd>{bio.profissoes.join(', ')}</dd></div>
					{/if}
					<div>
						<dt>{casa === 'senado' ? 'No Senado' : 'Na Câmara'}</dt>
						<dd>
							{#if anteriores.length}
								{anteriores.length + 1}º mandato · antes, {anteriores.map((m) => anosTxt(m.de, m.ate)).join(', ')}
							{:else}
								Primeiro mandato
							{/if}
							{#if bio?.condicao && bio.condicao !== 'Titular'} · {bio.condicao}{/if}
						</dd>
					</div>
					{#if bio?.gabinete?.email}
						<div>
							<dt>Gabinete</dt>
							<dd>
								<a href={`mailto:${bio.gabinete.email}`}>{bio.gabinete.email}</a>
								{#if bio.gabinete.telefone}<br />(61) {bio.gabinete.telefone}{/if}
							</dd>
						</div>
					{/if}
					{#if bio?.redes?.length}
						<div>
							<dt>Redes</dt>
							<dd class="redes">
								{#each bio.redes as u}
									{@const nome = redeNome(u)}
									<a class="rede" href={u} target="_blank" rel="noreferrer" aria-label={nome} title={nome}>
										{#if ICONES[nome]}
											<svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONES[nome]} /></svg>
										{:else if nome === 'Instagram'}
											<svg viewBox="0 0 24 24" aria-hidden="true" class="traco"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="1.1" class="cheio" /></svg>
										{:else}
											<svg viewBox="0 0 24 24" aria-hidden="true" class="traco"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18" /></svg>
										{/if}
									</a>
								{/each}
							</dd>
						</div>
					{/if}
				</dl>
				{#if bio?.mandatos?.length || bio?.ocupacoes?.length}
					<div class="tempo">
					{#if linhaTempo.length > 6}
						<button type="button" class="mais mais--antes" on:click={() => (tempoTodo = !tempoTodo)}>
							{tempoTodo
								? 'Mostrar só os recentes'
								: linhaTempo.length === 7
									? 'Mostrar o anterior'
									: `Mostrar os ${linhaTempo.length - 6} anteriores`}
						</button>
					{/if}
					<ol class="linha-tempo">
						{#each tempoTodo ? linhaTempo : linhaTempo.slice(-6) as item, i}
							<li class="entra" style={`--d:${i * 70}ms`} class:mandato={item.tipo === 'mandato'}>
								<span class="anos-item">{anosTxt(item.de, item.ate)}</span>
								{#if item.tipo === 'mandato'}
									<b>{titulo(item.cargo)}</b>
									<span>{item.municipio ? `${titulo(item.municipio)}-` : ''}{item.uf}{item.partido ? ` · ${item.partido}` : ''}</span>
								{:else}
									<b>{item.titulo}</b>
									<span>{item.entidade}{item.uf ? ` · ${item.uf}` : ''}</span>
								{/if}
							</li>
						{/each}
					</ol>
					</div>
				{/if}
			</div>
		</section>
	{/if}

	<section class="sec aguarda-vista" use:emVista use:reveal>
		<hr class="regua desenha" />
		<p class="ds-label">{numero('posicao')} · Posição</p>
		<h2>Onde {art} {cargo} fica no plenário</h2>
		<p class="lead">
			Cada ponto é um {K.umOuUma}, posicionado só pelo que votou. Quem vota junto fica perto. Em escuro, o
			{p.partido}.
		</p>
		<div class="eixo aparece" style="--d:150ms" bind:clientWidth={largura}>
			<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${p.nome} na posição ${num(p.eixo, 1)} de 10`}>
				<line x1={M} x2={W - M} y1={118} y2={118} class="eixo-linha" />
				{#each [0, 2.5, 5, 7.5, 10] as t}
					<line x1={xPos(t)} x2={xPos(t)} y1="114" y2="122" class="marca" />
					<text x={xPos(t)} y="138" class="marca-txt">{t.toLocaleString('pt-BR')}</text>
				{/each}
				{#each pontos as pt}
					{#if !pt.eu}
						<circle
							cx={pt.x}
							cy={pt.y}
							r={foco === pt ? raio + 2.5 : raio}
							class:meu={pt.meu}
							class:foco={foco === pt}
							class="ponto"
							role="link"
							tabindex="-1"
							aria-label={`${pt.d.nome}, ${pt.d.partido}`}
							on:pointerenter={() => mostrar(pt)}
							on:pointerleave={esconder}
							on:pointerdown={(e) => (ultimoPonteiro = e.pointerType)}
							on:click={() => abrir(pt)}
							on:keydown={(e) => e.key === 'Enter' && abrir(pt)}
						/>
					{/if}
				{/each}
				{#if comp.eixo.partido != null}
					<line x1={xPos(comp.eixo.partido)} x2={xPos(comp.eixo.partido)} y1="24" y2="118" class="media-partido" />
				{/if}
				<line x1={xPos(p.eixo)} x2={xPos(p.eixo)} y1="14" y2="118" class="eu-linha" />
				<circle cx={xPos(p.eixo)} cy="14" r="9" class="eu" />
			</svg>
			{#if foco}
				<div class="tip dica" style={`left:${tipX}px;top:${foco.y}px;--desvio:${tipX - foco.x}px`}>
					<span class="dica-rotulo">{foco.d.partido} · {foco.d.uf}</span>
					<span class="dica-titulo">{foco.d.nome}</span>
					<span class="dica-valor">{num(foco.d.eixo, 1)}<small>de 10 no eixo</small></span>
				</div>
			{/if}
			<div class="eixo-rotulos">
				<span>← progressista</span>
				<span>conservador →</span>
			</div>
		</div>
	</section>

	<section class="sec aguarda-vista" use:emVista use:reveal>
		<hr class="regua desenha" />
		<p class="ds-label">{numero('votos')} · Votos</p>
		<h2>Como votou</h2>
		<!-- One block: the whole period on the left, year by year on the right -->
		<div class="votos-bloco" class:um-ano={anos.length < 2}>
			<div>
				<h3>No período</h3>
				<div class="barra-votos" role="img" aria-label={Object.entries(p.contagem).map(([t, n]) => `${t}: ${n}`).join(', ')}>
					{#each Object.entries(p.contagem) as [tipo, n], i}
						{#if n}
							<i class="cresce-x" style={`flex:${n};background:${corVoto(tipo)};--i:${i}`} />
						{/if}
					{/each}
				</div>
				<ul class="legenda">
					{#each Object.entries(p.contagem).filter(([, n]) => n) as [tipo, n]}
						<li><i style={`background:${corVoto(tipo)}`} /><span class="tipo">{tipo}</span> <b>{num(n)}</b> <span>{num((n / totalContagem) * 100)}%</span></li>
					{/each}
				</ul>
			</div>
			{#if anos.length > 1}
				<div>
					<h3>Ano a ano</h3>
					<table class="anos">
						<thead>
							<tr><th>Ano</th><th>Votos</th><th>Com o governo</th><th>Com o partido</th></tr>
						</thead>
						<tbody>
							{#each anos as [ano, v], i}
								<tr style={`--i:${i}`}>
									<td>{ano}</td>
									<td>{num(v.votos)}</td>
									<td>
										<span class="mini"><i class="cresce-x" style={`width:${v.governismo ?? 0}%`} /></span>
										{num(v.governismo)}{v.governismo == null ? '' : '%'}
									</td>
									<td>
										<span class="mini"><i class="cresce-x" style={`width:${v.fidelidade ?? 0}%`} /></span>
										{num(v.fidelidade)}{v.fidelidade == null ? '' : '%'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</section>

	{#if p.divergencias?.length}
		<section class="sec aguarda-vista" use:emVista use:reveal>
			<hr class="regua desenha" />
			<p class="ds-label">{numero('contra')} · Contra o partido</p>
			<h2>Quando votou diferente do {p.partido}</h2>
			<p class="lead">
				{num(p.totalDivergencias)} votações no total{p.totalDivergencias > p.divergencias.length
					? `; aqui as ${p.divergencias.length} mais recentes`
					: ''}.
			</p>
			<ol class="divs">
				{#each divergencias as d}
					<li>
						<time datetime={d.data}>{data_(d.data, 'dd/MM/yy')}</time>
						<div class="texto">
							{#if d.ementa}<p class="ementa">{d.ementa}</p>{/if}
							<p class="acao">{limpa(d.descricao)}</p>
						</div>
						<div class="votos">
							<span class="chip eu">
								<small>{art === 'a' ? 'Ela' : 'Ele'}</small>
								<b class:claro={claro(d.voto)} style={`background:${corVoto(d.voto)}`}>{d.voto}</b>
							</span>
							<span class="vs" aria-hidden="true">≠</span>
							<span class="chip">
								<small>{d.porOrientacao ? 'Partido orientou' : 'Maioria do partido'}</small>
								<b class:claro={claro(d.partido)} style={`background:${corVoto(d.partido)}`}>{d.partido}</b>
							</span>
							{#if d.governo}
								<span class="chip gov">
									<small>Governo</small>
									<b class:claro={claro(d.governo)} style={`background:${corVoto(d.governo)}`}>{d.governo}</b>
								</span>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
			{#if p.divergencias.length > 8}
				<button type="button" class="mais" on:click={() => (mostrarTodas = !mostrarTodas)}>
					{mostrarTodas ? 'Mostrar menos' : `Mostrar as ${p.divergencias.length}`}
				</button>
			{/if}
		</section>
	{/if}

	{#if custos}
		<section class="sec aguarda-vista" use:emVista use:reveal>
			<hr class="regua desenha" />
			<p class="ds-label">{numero('custos')} · Custos</p>
			<h2>Quanto gasta da cota parlamentar</h2>
			<p class="lead">
				Além do salário, cada {cargo} tem uma cota mensal para despesas do mandato: passagens, combustível,
				escritório, divulgação. {K.publica}
			</p>

			<div class="custo-topo">
			<div class="custo-kpis">
				<div>
					<p class="valor">{reais(custos.mediaMensal, true)}<small>/mês</small></p>
					<p class="leitura">Média dos meses com despesa desde fevereiro de 2023.</p>
					<p class="comp">{K.curta} {reais(gastoCamara, true)} · {p.uf} {reais(gastoUF, true)}</p>
				</div>
				<div>
					<p class="valor">{reais(custos.total, true)}</p>
					<p class="leitura">No total, em {num(custos.documentos)} notas reembolsadas.</p>
					{#if posGasto}<p class="comp">{num(posGasto)}º maior gasto mensal entre {num(totalGastadores)}</p>{/if}
				</div>
			</div>

			<div class="custo-meses">
			<!-- As wide as the months need, so the columns sit --coluna-vao apart at the shared thickness -->
			<div class="meses" role="img" aria-label="Gasto por mês" style={`max-width:calc(${custos.meses.length} * (var(--barra-espessura) + var(--coluna-vao)))`}>
				{#each custos.meses as [m, v], i}
					<span
						class="mes"
						class:janeiro={m.endsWith('-01')}
						on:pointerenter={() => (focoMes = [m, v])}
						on:pointerleave={() => (focoMes = null)}
					>
						<i class="cresce-y" style={`height:${(v / maxMes) * 100}%;--i:${i}`} />
						{#if m.endsWith('-01')}<em>{m.slice(0, 4)}</em>{/if}
					</span>
				{/each}
			</div>
			<p class="mes-foco">
				{#if focoMes}<b>{mesCurto(focoMes[0])}</b>: {reais(focoMes[1])}{:else}Gasto mês a mês. Passe o dedo ou o mouse nas barras.{/if}
			</p>
			</div>
			</div>

			<div class="duas-col">
				<div>
					<h3>Em quê</h3>
					<ul class="cats">
						{#each categoriasTop as c, i}
							<li>
								<span class="cat-nome">{c.nome}</span>
								<span class="cat-barra"><i class="cresce-x" style={`width:${(c.valor / maxCat) * 100}%;--i:${i}`} /></span>
								<span class="cat-valor">{reais(c.valor, true)}</span>
							</li>
						{/each}
					</ul>
				</div>
				<div>
					<h3>Com quem</h3>
					<ol class="forn">
						{#each custos.fornecedores as f}
							<li>
								<span>{f.nome}</span>
								<b>{reais(f.valor, true)}</b>
								<small>{num(f.notas)} {f.notas === 1 ? 'nota' : 'notas'}</small>
							</li>
						{/each}
					</ol>
				</div>
			</div>
			<p class="fonte">
				Fonte: {K.cotaNome}. Valores líquidos
				reembolsados. O teto da cota varia por estado (é maior para quem mora longe de Brasília), por isso a
				comparação com {p.uf}. Não inclui salário nem verba de gabinete.
				<a href={K.notas(p.id)} target="_blank" rel="noopener">{K.notasRotulo}</a>
			</p>
		</section>
	{/if}

	<section class="sec metodo" use:reveal>
		<hr class="regua desenha" />
		<p class="ds-label">Como calculamos</p>
		<ul>
			<li>
				<b>Base:</b> as votações nominais do plenário {casa === 'senado' ? 'do Senado' : 'da Câmara'} nesta legislatura
				(desde fevereiro de 2023), voto a voto, com dados da {K.fonteVotos}.{#if casa === 'senado'} O Senado decide a maior
					parte das matérias em votação simbólica, sem registro de quem votou como; só as nominais entram aqui.{/if}
			</li>
			<li>
				<b>Presença:</b> votos registrados sobre as votações realizadas entre o primeiro e o último voto d{art}
				{cargo}. Suplentes só contam o período em que estavam no cargo.{#if casa === 'senado'} Ausências justificadas
					(missão, licença, atividade parlamentar) também contam como ausência.{/if}
			</li>
			<li>
				<b>Com o governo:</b> vezes em que votou como o líder do governo orientou, entre as votações em que houve
				orientação de sim ou não. Obstrução conta como voto contra; abstenção, como não seguir.
			</li>
			<li>
				<b>Com o partido:</b> o mesmo cálculo com a orientação do partido, da federação ou do bloco. Quando não
				houve orientação, vale o voto da maioria da bancada naquela votação.
			</li>
			<li>
				<b>Progressista → conservador:</b> uma escala estatística que coloca cada {K.masc} conforme com quem vota
				junto, sem classificar votação por votação. Os extremos são definidos pelos blocos que votam de forma mais
				oposta, {K.polos}. Nesta legislatura esse eixo também separa governo e
				oposição, então leia como posição no plenário, não como ideologia declarada.
			</li>
		</ul>
	</section>
</main>

<style>
	.pagina {
		width: calc(100% - var(--grid) * 4);
		max-width: 980px;
		margin: 0 auto;
		padding: calc(var(--grid) * 4) 0 calc(var(--grid) * 8);
	}

	/* Same sticky bar as the votes page: where you are, and the arrows to the next deputy */
	.barra {
		position: sticky;
		top: 0;
		z-index: 20;
		background: color-mix(in srgb, var(--color-light) 88%, transparent);
		backdrop-filter: blur(14px) saturate(1.4);
		-webkit-backdrop-filter: blur(14px) saturate(1.4);
		border-bottom: 1px solid var(--color-rule);
	}

	.barra-inner {
		width: calc(100% - var(--grid) * 4);
		max-width: 980px;
		margin: 0 auto;
		padding: calc(var(--grid) * 1) 0;
	}




	.passos {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--grid) * 1);
	}

	.status {
		font-size: var(--t-label);
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);
		min-width: 7ch;
		text-align: center;
	}

	.status b {
		color: var(--color-dark);
		font-weight: 600;
	}

	.circulo {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: calc(var(--grid) * 3.6);
		height: calc(var(--grid) * 3.6);
		border: 1px solid var(--color-dark);
		border-radius: 999px;
		color: var(--color-dark);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: background-color 180ms var(--ease), color 180ms var(--ease), transform 180ms var(--ease);
	}

	.circulo:hover {
		background: var(--color-dark);
		color: var(--color-light);
	}

	@media (pointer: coarse) {
		.circulo {
			width: 44px;
			height: 44px;
		}

		.circulo:active {
			transform: scale(0.94);
		}
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

	.cabeca {
		display: flex;
		gap: calc(var(--grid) * 2.4);
		align-items: center;
	}

	.foto {
		width: calc(var(--grid) * 10.4);
		height: calc(var(--grid) * 10.4);
		box-shadow: 0 0 0 1px var(--color-rule);
	}

	.quem {
		min-width: 0;
	}

	.quem .ds-label {
		margin-bottom: calc(var(--grid) * 0.4);
	}

	h1 {
		font-size: clamp(calc(var(--grid) * 3.8), 5vw, calc(var(--grid) * 5.8));
		line-height: 1.02;
		letter-spacing: -0.02em;
		margin: 0 0 calc(var(--grid) * 1);
	}

	.linha-id {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: calc(var(--grid) * 0.6) calc(var(--grid) * 1.2);
		margin: 0;
		font-size: var(--t-small);
		color: var(--color-text-muted);
	}

	.sigla-partido {
		padding: calc(var(--grid) * 0.2) calc(var(--grid) * 1.2);
		border-radius: 999px;
		background: var(--color-dark);
		color: var(--color-light);
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.trocas {
		font-style: italic;
	}

	.ficha {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: calc(var(--grid) * 3) calc(var(--grid) * 6);
		align-items: start;
	}

	.dados {
		margin: 0;
	}

	.dados div {
		display: grid;
		grid-template-columns: 13ch 1fr;
		gap: calc(var(--grid) * 1.5);
		padding: calc(var(--grid) * 1.1) 0;
		border-top: 1px solid var(--color-rule);
		font-size: var(--t-small);
	}

	.dados dt {
		color: var(--color-text-muted);
		font-weight: 600;
	}

	.dados dd {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.dados a {
		color: var(--color-dark);
	}

	.redes {
		display: flex;
		flex-wrap: wrap;
		gap: calc(var(--grid) * 0.8);
	}

	.rede {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: calc(var(--grid) * 4);
		height: calc(var(--grid) * 4);
		border: 1px solid var(--color-dark);
		border-radius: 50%;
		color: var(--color-dark);
		cursor: pointer;
		transition: background-color 180ms var(--ease), color 180ms var(--ease);
	}

	.rede:hover {
		background: var(--color-dark);
		color: var(--color-light);
	}

	.rede svg {
		width: 17px;
		height: 17px;
		fill: currentColor;
	}

	.rede svg.traco {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
	}

	.rede svg .cheio {
		fill: currentColor;
		stroke: none;
	}

	.linha-tempo {
		list-style: none;
		margin: 0;
		padding: 0 0 0 calc(var(--grid) * 2);
	}

	/* The thread runs from each dot to the next one only: nothing above the first or below the last */
	.linha-tempo li::after {
		content: '';
		position: absolute;
		left: calc(var(--grid) * -2 - 2px);
		top: 16px;
		bottom: -4px;
		width: 2px;
		background: var(--color-rule);
	}

	.linha-tempo li:last-child::after {
		display: none;
	}

	.linha-tempo li {
		position: relative;
		display: flex;
		flex-direction: column;
		padding: 0 0 calc(var(--grid) * 2);
		font-size: var(--t-small);
		line-height: 1.4;
	}

	.linha-tempo li::before {
		content: '';
		position: absolute;
		left: calc(var(--grid) * -2 - 7px);
		top: 4px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--color-light);
		border: 2px solid var(--vote-nao);
	}

	.linha-tempo li.mandato::before {
		background: var(--accent-amber);
		border-color: var(--accent-amber);
	}

	.anos-item {
		font-size: var(--t-label);
		font-weight: 600;
		color: var(--accent-amber-ink);
		font-variant-numeric: tabular-nums;
	}

	.linha-tempo span:last-child {
		color: var(--color-text-muted);
	}

	.kpis {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin: calc(var(--grid) * 4) 0 0;
		border-top: var(--regua);
	}

	.kpi {
		display: flex;
		flex-direction: column;
		padding: calc(var(--grid) * 2) calc(var(--grid) * 2.4) 0;
		border-left: 1px solid var(--color-rule);
	}

	.kpi:first-child {
		padding-left: 0;
		border-left: 0;
	}

	.kpi dt {
		font-size: var(--t-small);
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.kpi dd {
		margin: 0;
	}

	.numero {
		margin: calc(var(--grid) * 0.4) 0 calc(var(--grid) * 1.2) !important;
		font-family: var(--font-display);
		font-size: calc(var(--grid) * 4.6);
		line-height: 1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}

	.numero small {
		font-size: 0.45em;
		margin-left: 2px;
		color: var(--color-text-muted);
	}

	/* The gauge: this person's bar, a dark tick for the house, an amber one for the party */
	.medidor {
		position: relative;
		height: var(--barra-espessura);
		border-radius: var(--raio-barra);
		background: var(--color-track);
	}

	.medidor .cheio {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: var(--raio-barra);
		background: var(--vote-sim);
	}

	.marca-casa,
	.marca-partido {
		position: absolute;
		top: -5px;
		bottom: -5px;
		width: 2px;
		margin-left: -1px;
		border-radius: 1px;
	}

	.marca-casa {
		background: var(--color-dark);
	}

	.marca-partido {
		background: var(--accent-amber);
	}

	.ponto-eu {
		position: absolute;
		top: 50%;
		width: 16px;
		height: 16px;
		margin: -8px 0 0 -8px;
		border-radius: 50%;
		background: var(--vote-sim);
		border: 3px solid var(--color-light);
		box-shadow: 0 0 0 1px var(--vote-sim);
	}

	.comp {
		display: flex;
		flex-wrap: wrap;
		gap: 2px calc(var(--grid) * 1.4);
		margin-top: calc(var(--grid) * 1.2) !important;
		font-size: var(--t-mini);
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.comp span {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		white-space: nowrap;
	}

	.tique {
		width: 2px;
		height: 10px;
		border-radius: 1px;
	}

	.tique--casa {
		background: var(--color-dark);
	}

	.tique--partido {
		background: var(--accent-amber);
	}

	.leitura {
		margin-top: calc(var(--grid) * 0.8) !important;
		font-size: var(--t-small);
		line-height: 1.4;
	}

	.sec {
		margin-top: calc(var(--grid) * 9);
	}

	.regua {
		border: 0;
		border-top: var(--regua);
		margin: 0 0 calc(var(--grid) * 4);
	}

	h2 {
		font-size: calc(var(--grid) * 3.6);
		line-height: 1.12;
		margin: calc(var(--grid) * 0.6) 0 calc(var(--grid) * 1.5);
	}

	.lead {
		color: var(--color-text-muted);
		margin: 0 0 calc(var(--grid) * 3);
	}

	.eixo {
		position: relative;
	}

	.marca {
		stroke: var(--color-dark);
		stroke-width: 1;
	}

	.marca-txt {
		font-family: var(--font-primary);
		font-size: var(--t-mini);
		fill: var(--color-text-muted);
		text-anchor: middle;
	}

	.ponto {
		cursor: pointer;
		transition: r 140ms var(--ease), fill 140ms var(--ease);
	}

	.ponto.foco {
		fill: var(--color-dark);
		stroke: var(--color-light);
		stroke-width: 2;
	}

	.ponto:focus {
		outline: none;
	}

	.tip {
		position: absolute;
		transform: translate(-50%, calc(-100% - 14px));
		z-index: 5;
	}






	.eixo svg {
		width: 100%;
		height: auto;
		display: block;
		overflow: visible;
	}

	.eixo-linha {
		stroke: var(--color-dark);
		stroke-width: 1.5;
	}

	.ponto {
		fill: var(--vote-ausentes);
	}

	.ponto.meu {
		fill: var(--vote-obstrucao);
	}

	.media-partido {
		stroke: var(--vote-obstrucao);
		stroke-width: 2;
		stroke-dasharray: 4 4;
	}

	.eu-linha {
		stroke: var(--accent-amber);
		stroke-width: 3;
	}

	.eu {
		fill: var(--accent-amber);
		stroke: var(--color-light);
		stroke-width: 3;
	}

	.eixo-rotulos {
		display: flex;
		justify-content: space-between;
		font-size: var(--t-small);
		font-weight: 600;
		margin-top: calc(var(--grid) * 0.8);
	}

	.eixo-rotulos span:first-child {
		color: var(--vote-sim);
	}

	.anos {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--t-small);
		font-variant-numeric: tabular-nums;
	}

	.anos th {
		text-align: left;
		font-weight: 600;
		color: var(--color-text-muted);
		padding: 0 0 calc(var(--grid) * 1);
	}

	.anos td {
		border-top: 1px solid var(--color-rule);
		padding: calc(var(--grid) * 1) calc(var(--grid) * 1) calc(var(--grid) * 1) 0;
		white-space: nowrap;
	}

	.mini {
		display: inline-block;
		width: 90px;
		height: var(--barra-espessura);
		border-radius: 999px;
		background: var(--vote-ausentes);
		overflow: hidden;
		vertical-align: middle;
		margin-right: 6px;
	}

	.mini i {
		display: block;
		height: 100%;
		background: var(--vote-sim);
	}

	.votos-bloco {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		gap: calc(var(--grid) * 3) calc(var(--grid) * 6);
		align-items: start;
	}

	.votos-bloco.um-ano {
		grid-template-columns: 1fr;
	}

	.votos-bloco h3 {
		font-size: var(--t-small);
		font-weight: 600;
		margin: 0 0 calc(var(--grid) * 1.6);
	}

	/* The legend as a short list under the bar, one type per line */
	.votos-bloco .legenda {
		flex-direction: column;
		gap: 0;
	}

	.votos-bloco .legenda li {
		display: grid;
		grid-template-columns: 10px minmax(0, 1fr) auto 5ch;
		align-items: center;
		gap: calc(var(--grid) * 1);
		padding: calc(var(--grid) * 0.8) 0;
		border-top: 1px solid var(--color-rule);
		font-variant-numeric: tabular-nums;
	}

	.votos-bloco .legenda .tipo {
		color: var(--color-dark);
	}

	.votos-bloco .legenda li:first-child {
		border-top: 0;
	}

	.votos-bloco .legenda li span:last-child {
		text-align: right;
	}

	.barra-votos {
		display: flex;
		gap: 2px;
		height: var(--barra-espessura);
		border-radius: 999px;
		overflow: hidden;
	}

	.barra-votos i {
		display: block;
		min-width: 2px;
	}

	.legenda {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: calc(var(--grid) * 1) calc(var(--grid) * 3);
		padding: 0;
		margin: calc(var(--grid) * 1.5) 0 0;
		font-size: var(--t-small);
	}

	.legenda li,
	.votos span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.legenda i,
	.votos i {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.legenda span {
		color: var(--color-text-muted);
	}

	.divs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: calc(var(--grid) * 6);
	}

	.divs li {
		display: grid;
		grid-template-columns: 8ch 1fr;
		gap: 4px calc(var(--grid) * 2);
		padding: calc(var(--grid) * 1.6) 0;
		border-top: 1px solid var(--color-rule);
	}

	.divs time {
		font-size: var(--t-small);
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.divs p {
		margin: 0;
		font-size: var(--t-small);
		line-height: 1.45;
	}

	.ementa {
		color: var(--color-dark);
		margin-bottom: 2px !important;
	}

	.acao {
		color: var(--color-text-muted);
	}

	.mais {
		justify-self: start;
		align-self: flex-start;
		margin-top: calc(var(--grid) * 2);
		font: inherit;
		font-size: var(--t-small);
		font-weight: 600;
		padding: calc(var(--grid) * 0.9) calc(var(--grid) * 1.8);
		border: 1px solid var(--color-dark);
		border-radius: 999px;
		background: none;
		color: var(--color-dark);
		cursor: pointer;
	}

	.mais--antes {
		margin: 0 0 calc(var(--grid) * 2);
	}

	.mais:hover {
		background: var(--color-dark);
		color: var(--color-light);
	}

	.votos {
		grid-column: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: calc(var(--grid) * 0.6) calc(var(--grid) * 1.2);
		margin-top: calc(var(--grid) * 0.8);
	}

	.chip {
		display: inline-flex;
		flex-direction: column;
		gap: 3px;
	}

	.chip small {
		font-size: var(--t-mini);
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--color-text-muted);
	}

	.chip b {
		align-self: flex-start;
		min-width: 9ch;
		text-align: center;
		font-size: var(--t-small);
		font-weight: 600;
		padding: calc(var(--grid) * 0.4) calc(var(--grid) * 1.4);
		border-radius: 999px;
		color: var(--color-light);
	}

	.chip b.claro {
		color: var(--color-dark);
	}

	.chip.eu b {
		box-shadow: 0 0 0 2px var(--color-light), 0 0 0 3.5px var(--accent-amber);
	}

	.chip.gov {
		margin-left: calc(var(--grid) * 1);
		padding-left: calc(var(--grid) * 2);
		border-left: 1px solid var(--color-rule);
	}

	.vs {
		align-self: flex-end;
		padding-bottom: 3px;
		font-size: var(--t-control);
		font-weight: 600;
		color: var(--accent-amber-ink);
	}

	/* Desktop: the two figures and the month chart on one line */
	.custo-topo {
		display: grid;
		grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr);
		gap: calc(var(--grid) * 3) calc(var(--grid) * 6);
		align-items: end;
		margin-bottom: calc(var(--grid) * 2);
	}

	/* The two figures one above the other, the chart beside them */
	.custo-topo .custo-kpis {
		grid-template-columns: 1fr;
		gap: calc(var(--grid) * 2.5);
		margin: 0;
	}

	.custo-topo .valor {
		white-space: nowrap;
	}

	.custo-topo .mes-foco {
		margin-bottom: 0;
	}

	.custo-meses .meses {
		margin-left: auto;
		height: calc(var(--grid) * 22);
	}

	.custo-kpis {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: calc(var(--grid) * 3);
		margin: calc(var(--grid) * 2) 0 calc(var(--grid) * 3);
	}

	.custo-kpis .valor {
		font-family: var(--font-display);
		font-size: clamp(36px, 6vw, 56px);
		font-weight: 500;
		line-height: 1;
		margin: 0 0 calc(var(--grid) * 1);
		font-variant-numeric: tabular-nums;
	}

	.custo-kpis .valor small {
		font-size: 0.4em;
		color: var(--color-text-muted);
		margin-left: 4px;
	}

	.custo-kpis .leitura {
		margin: 0;
		font-size: var(--t-small);
	}

	.custo-kpis .comp {
		margin: 4px 0 0;
		font-size: var(--t-small);
		color: var(--color-text-muted);
	}

	.meses {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 120px;
		border-bottom: 1px solid var(--color-dark);
		margin-bottom: 22px;
	}

	.mes {
		position: relative;
		cursor: pointer;
		flex: 1;
		height: 100%;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.mes i {
		display: block;
		width: min(var(--barra-espessura), 100%);
		min-height: 2px;
		border-radius: var(--raio-coluna);
		background: var(--vote-obstrucao);
		transition: background 120ms var(--ease);
	}

	.mes:hover i {
		background: var(--accent-amber);
	}

	.mes em {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		font-style: normal;
		font-size: var(--t-mini);
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.mes.janeiro::before {
		content: '';
		position: absolute;
		left: -1.5px;
		bottom: -4px;
		height: 4px;
		width: 1px;
		background: var(--color-dark);
	}

	.mes-foco {
		min-height: 1.5em;
		font-size: var(--t-small);
		color: var(--color-text-muted);
		margin: 0 0 calc(var(--grid) * 3);
	}

	.mes-foco b {
		color: var(--color-dark);
		text-transform: capitalize;
	}

	.duas-col {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: calc(var(--grid) * 4);
	}

	.duas-col h3 {
		font-size: var(--t-small);
		font-weight: 600;
		margin: 0 0 calc(var(--grid) * 1);
	}

	.cats,
	.forn {
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: var(--t-small);
	}

	.cats li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 28% max-content;
		align-items: center;
		gap: calc(var(--grid) * 1);
		padding: 7px 0;
		border-top: 1px solid var(--color-rule);
	}

	.cat-barra {
		height: var(--barra-espessura);
		border-radius: 999px;
		background: var(--vote-ausentes);
		overflow: hidden;
	}

	.cat-barra i {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--vote-sim);
	}

	.cat-valor {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.forn li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0 calc(var(--grid) * 1);
		padding: 7px 0;
		border-top: 1px solid var(--color-rule);
	}

	.forn span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.forn b {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.forn small {
		grid-column: 1;
		color: var(--color-text-muted);
	}

	.fonte {
		margin: calc(var(--grid) * 3) 0 0;
		font-size: var(--t-small);
		color: var(--color-text-muted);
	}

	.fonte a {
		color: var(--accent-amber-ink);
		font-weight: 600;
	}

	@media (max-width: 760px) {
		.duas-col {
			grid-template-columns: 1fr;
		}

		.custo-kpis {
			grid-template-columns: 1fr;
			gap: calc(var(--grid) * 2.5);
		}

		.custo-kpis .valor {
			white-space: nowrap;
		}

		.meses {
			gap: 1px;
			height: 90px;
		}
	}

	.metodo ul {
		margin: 0;
		padding-left: 1.1em;
		font-size: var(--t-small);
		line-height: 1.55;
		color: var(--color-text-muted);
	}

	.metodo li {
		margin-bottom: calc(var(--grid) * 1);
	}

	.metodo b {
		color: var(--color-dark);
	}

	@media (max-width: 760px) {
		.ficha,
		.votos-bloco,
		.custo-topo,
		.divs {
			grid-template-columns: 1fr;
		}

		.custo-meses .meses {
			margin-left: 0;
			height: 110px;
		}

		.kpis {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.kpi {
			padding-bottom: calc(var(--grid) * 2.4);
		}

		.kpi:nth-child(3) {
			padding-left: 0;
			border-left: 0;
		}

		.kpi:nth-child(n + 3) {
			border-top: 1px solid var(--color-rule);
		}
	}

	@media (max-width: 600px) {
		.cabeca {
			gap: calc(var(--grid) * 1.6);
		}

		.foto {
			width: calc(var(--grid) * 8);
			height: calc(var(--grid) * 8);
		}

		.kpi {
			padding-left: calc(var(--grid) * 1.6);
			padding-right: 0;
		}

		.numero {
			font-size: calc(var(--grid) * 3.8);
		}

		.anos th:nth-child(2),
		.anos td:nth-child(2) {
			display: none;
		}

		.mini {
			width: 48px;
		}

		.divs li {
			grid-template-columns: 1fr;
		}

		.votos {
			grid-column: 1;
		}

		h2 {
			font-size: calc(var(--grid) * 2.6);
		}
	}
</style>
