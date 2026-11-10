<script>
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { format, parseISO } from 'date-fns';
	import ptBR from 'date-fns/locale/pt-BR/index.js';
	import { COR } from '$lib/votos.js';

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

	// Section numbers follow the sections actually shown
	$: secoes = [temTrajetoria && 'trajetoria', 'posicao', anos.length > 1 && 'anos', 'votos', p.divergencias?.length && 'contra', p.custos && 'custos'].filter(Boolean);
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
	<nav class="barra-inner" aria-label={`Navegação entre ${K.lista}`}>
		<div class="voltar">
			<a href={`${base}/`}>Votações</a>
			<span aria-hidden="true">/</span>
			<a href={`${base}/${K.lista}`}>{K.Lista}</a>
		</div>
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
	</nav>
</div>

<main class="pagina">

	<header class="cabeca">
		<span class="foto retrato"><img src={p.foto} alt="" width="120" height="120" /></span>
		<div>
			<p class="ds-label">{K.rotuloCargo(Cargo)} · {p.uf}</p>
			<h1>{p.nome}</h1>
			<p class="sub">
				{p.partido}
				{#if trocouPartido}
					<span class="trocas">
						· antes {p.partidos.slice(0, -1).map((x) => x.sigla).join(', ')}
					</span>
				{/if}
			</p>
			{#if bio?.profissoes?.length || idade}
				<p class="quem">
					{#if bio?.profissoes?.length}<b>{bio.profissoes.join(', ')}</b>{/if}
					{#if idade}<span>{idade} anos</span>{/if}
					{#if bio?.municipioNascimento}<span>{p.mulher ? 'nascida' : 'nascido'} em {titulo(bio.municipioNascimento)}-{bio.ufNascimento}</span>{/if}
				</p>
			{/if}
			<p class="periodo">
				{num(p.votos)} votos registrados entre {data_(p.periodo.de)} e {data_(p.periodo.ate)}
			</p>
		</div>
	</header>

	<dl class="kpis">
		<div class="kpi">
			<dt>Presença</dt>
			<dd>{num(p.presenca)}<small>%</small></dd>
			<p>Votou em {num(p.votos)} de {num(p.periodo.votacoes)} votações nominais no período.</p>
			{#if comp.presenca.camara != null}
				<p class="comp">{K.curta} {num(comp.presenca.camara)}% · {p.partido} {num(comp.presenca.partido)}%</p>
			{/if}
		</div>
		<div class="kpi">
			<dt>Com o governo</dt>
			<dd>{num(p.governismo)}<small>{p.governismo == null ? '' : '%'}</small></dd>
			<p>{leituraGoverno(p.governismo)}</p>
			{#if p.governismo != null && comp.governismo.camara != null}
				<p class="comp">{K.curta} {num(comp.governismo.camara)}% · {p.partido} {num(comp.governismo.partido)}%</p>
			{/if}
		</div>
		<div class="kpi">
			<dt>Com o partido</dt>
			<dd>{num(p.fidelidade)}<small>%</small></dd>
			<p>{leituraPartido(p.fidelidade)}</p>
			{#if comp.fidelidade.camara != null}
				<p class="comp">{K.curta} {num(comp.fidelidade.camara)}% · {p.partido} {num(comp.fidelidade.partido)}%</p>
			{/if}
		</div>
		<div class="kpi">
			<dt>Progressista → conservador</dt>
			<dd>{num(p.eixo, 1)}<small>/10</small></dd>
			<p>{leituraEixo(p.eixo)}</p>
			{#if comp.eixo.partido != null}
				<p class="comp">Média do {p.partido}: {num(comp.eixo.partido, 1)}</p>
			{/if}
		</div>
	</dl>

	{#if temTrajetoria}
		<section class="sec">
			<hr class="regua" />
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
								{#each bio.redes as u}<a href={u} target="_blank" rel="noreferrer">{redeNome(u)}</a>{/each}
							</dd>
						</div>
					{/if}
				</dl>
				{#if bio?.mandatos?.length || bio?.ocupacoes?.length}
					{#if linhaTempo.length > 6}
						<button type="button" class="mais mais--antes" on:click={() => (tempoTodo = !tempoTodo)}>
							{tempoTodo ? 'Mostrar só os recentes' : `Mostrar os ${linhaTempo.length - 6} anteriores`}
						</button>
					{/if}
					<ol class="linha-tempo">
						{#each tempoTodo ? linhaTempo : linhaTempo.slice(-6) as item}
							<li class:mandato={item.tipo === 'mandato'}>
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
				{/if}
			</div>
		</section>
	{/if}

	<section class="sec">
		<hr class="regua" />
		<p class="ds-label">{numero('posicao')} · Posição</p>
		<h2>Onde {art} {cargo} fica no plenário</h2>
		<p class="lead">
			Cada ponto é um {K.umOuUma}, posicionado só pelo que votou. Quem vota junto fica perto. Em escuro, o
			{p.partido}.
		</p>
		<div class="eixo" bind:clientWidth={largura}>
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
				<div class="tip" style={`left:${tipX}px;top:${foco.y}px`}>
					<span class="tip-nome">{foco.d.nome}</span>
					<span class="tip-sub">{foco.d.partido} · {foco.d.uf}</span>
					<span class="tip-num">{num(foco.d.eixo, 1)}<small>/10</small></span>
				</div>
			{/if}
			<div class="eixo-rotulos">
				<span>← progressista</span>
				<span>conservador →</span>
			</div>
		</div>
	</section>

	{#if anos.length > 1}
		<section class="sec">
			<hr class="regua" />
			<p class="ds-label">{numero('anos')} · Ano a ano</p>
			<h2>Como mudou o alinhamento</h2>
			<table class="anos">
				<thead>
					<tr><th>Ano</th><th>Votos</th><th>Com o governo</th><th>Com o partido</th></tr>
				</thead>
				<tbody>
					{#each anos as [ano, v]}
						<tr>
							<td>{ano}</td>
							<td>{num(v.votos)}</td>
							<td>
								<span class="mini"><i style={`width:${v.governismo ?? 0}%`} /></span>
								{num(v.governismo)}{v.governismo == null ? '' : '%'}
							</td>
							<td>
								<span class="mini"><i style={`width:${v.fidelidade ?? 0}%`} /></span>
								{num(v.fidelidade)}{v.fidelidade == null ? '' : '%'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}

	<section class="sec">
		<hr class="regua" />
		<p class="ds-label">{numero('votos')} · Votos</p>
		<h2>Como votou</h2>
		<div class="barra-votos" role="img" aria-label={Object.entries(p.contagem).map(([t, n]) => `${t}: ${n}`).join(', ')}>
			{#each Object.entries(p.contagem) as [tipo, n]}
				{#if n}
					<i style={`flex:${n};background:${corVoto(tipo)}`} />
				{/if}
			{/each}
		</div>
		<ul class="legenda">
			{#each Object.entries(p.contagem) as [tipo, n]}
				<li><i style={`background:${corVoto(tipo)}`} />{tipo} <b>{num(n)}</b> <span>{num((n / totalContagem) * 100)}%</span></li>
			{/each}
		</ul>
	</section>

	{#if p.divergencias?.length}
		<section class="sec">
			<hr class="regua" />
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
		<section class="sec">
			<hr class="regua" />
			<p class="ds-label">{numero('custos')} · Custos</p>
			<h2>Quanto gasta da cota parlamentar</h2>
			<p class="lead">
				Além do salário, cada {cargo} tem uma cota mensal para despesas do mandato: passagens, combustível,
				escritório, divulgação. {K.publica}
			</p>

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

			<div class="meses" role="img" aria-label="Gasto por mês">
				{#each custos.meses as [m, v]}
					<span
						class="mes"
						class:janeiro={m.endsWith('-01')}
						on:pointerenter={() => (focoMes = [m, v])}
						on:pointerleave={() => (focoMes = null)}
					>
						<i style={`height:${(v / maxMes) * 100}%`} />
						{#if m.endsWith('-01')}<em>{m.slice(0, 4)}</em>{/if}
					</span>
				{/each}
			</div>
			<p class="mes-foco">
				{#if focoMes}<b>{mesCurto(focoMes[0])}</b>: {reais(focoMes[1])}{:else}Gasto mês a mês. Passe o dedo ou o mouse nas barras.{/if}
			</p>

			<div class="duas-col">
				<div>
					<h3>Em quê</h3>
					<ul class="cats">
						{#each categoriasTop as c}
							<li>
								<span class="cat-nome">{c.nome}</span>
								<span class="cat-barra"><i style={`width:${(c.valor / maxCat) * 100}%`} /></span>
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

	<section class="sec metodo">
		<hr class="regua" />
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
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: calc(var(--grid) * 2);
		padding: calc(var(--grid) * 1) 0;
	}

	.voltar {
		display: flex;
		gap: calc(var(--grid) * 0.8);
		font-size: var(--t-small);
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.voltar a {
		color: var(--color-dark);
		text-decoration: none;
		cursor: pointer;
	}

	.voltar a:hover {
		color: var(--accent-amber-ink);
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
		gap: calc(var(--grid) * 3);
		align-items: center;
	}

	.foto {
		width: 120px;
		height: 120px;
	}


	h1 {
		font-size: clamp(calc(var(--grid) * 4), 6vw, calc(var(--grid) * 7));
		line-height: 1.02;
		letter-spacing: -0.02em;
		margin: calc(var(--grid) * 0.6) 0;
	}

	.sub {
		font-size: var(--t-lead);
		font-weight: 600;
		margin: 0;
	}

	.trocas {
		font-weight: 400;
		color: var(--color-text-muted);
	}

	.periodo {
		font-size: var(--t-small);
		color: var(--color-text-muted);
		margin: calc(var(--grid) * 0.6) 0 0;
	}

	.quem {
		display: flex;
		flex-wrap: wrap;
		gap: 2px calc(var(--grid) * 1.4);
		margin: calc(var(--grid) * 0.8) 0 0;
		font-size: var(--t-small);
	}

	.quem span {
		color: var(--color-text-muted);
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
		gap: 4px calc(var(--grid) * 1.4);
	}

	.linha-tempo {
		list-style: none;
		margin: 0;
		padding: 0 0 0 calc(var(--grid) * 2);
		border-left: 2px solid var(--color-rule);
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
		grid-template-columns: repeat(4, 1fr);
		gap: calc(var(--grid) * 3);
		margin: calc(var(--grid) * 5) 0 0;
		padding-top: calc(var(--grid) * 3);
		border-top: 1px solid var(--color-rule);
	}

	.kpi {
		display: flex;
		flex-direction: column;
	}

	.kpi dt {
		order: 0;
		font-size: var(--t-small);
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.kpi dd {
		margin: calc(var(--grid) * 0.6) 0;
		font-family: var(--font-display);
		font-size: calc(var(--grid) * 6);
		line-height: 1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}

	.kpi dd small {
		font-size: 0.45em;
		margin-left: 2px;
		color: var(--color-text-muted);
	}

	.kpi p {
		font-size: var(--t-small);
		margin: 0 0 calc(var(--grid) * 0.6);
		line-height: 1.4;
	}

	.kpi .comp {
		color: var(--color-text-muted);
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
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: calc(var(--grid) * 1.1) calc(var(--grid) * 1.6);
		border-radius: var(--raio-tip);
		background: var(--color-dark);
		color: var(--color-light);
		box-shadow: var(--shadow-2);
		white-space: nowrap;
		pointer-events: none;
		z-index: 5;
	}

	.tip::after {
		content: '';
		position: absolute;
		left: 50%;
		bottom: -6px;
		width: 12px;
		height: 12px;
		margin-left: -6px;
		background: var(--color-dark);
		transform: rotate(45deg);
		border-radius: 2px;
	}

	.tip-nome {
		font-weight: 600;
		font-size: var(--t-small);
	}

	.tip-sub {
		font-size: var(--t-label);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.tip-num {
		font-family: var(--font-display);
		font-size: calc(var(--grid) * 3);
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}

	.tip-num small {
		font-size: 0.5em;
		opacity: 0.7;
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
		height: 8px;
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

	.barra-votos {
		display: flex;
		gap: 2px;
		height: calc(var(--grid) * 2.4);
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
		flex: 1;
		height: 100%;
		display: flex;
		align-items: flex-end;
	}

	.mes i {
		display: block;
		width: 100%;
		min-height: 1px;
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
		height: 8px;
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
		.ficha {
			grid-template-columns: 1fr;
		}

		.kpis {
			grid-template-columns: repeat(2, 1fr);
			gap: calc(var(--grid) * 3) calc(var(--grid) * 2);
		}

		.kpi dd {
			font-size: calc(var(--grid) * 4.6);
		}
	}

	@media (max-width: 600px) {
		.cabeca {
			flex-direction: column;
			align-items: flex-start;
			gap: calc(var(--grid) * 2);
		}

		.foto {
			width: 88px;
			height: 88px;
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
