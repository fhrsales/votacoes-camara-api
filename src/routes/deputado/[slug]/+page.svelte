<script>
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { format, parseISO } from 'date-fns';
	import ptBR from 'date-fns/locale/pt-BR/index.js';
	import { COR } from '$lib/votos.js';

	export let data;
	$: p = data.perfil;
	$: art = p.mulher ? 'a' : 'o';
	$: cargo = p.mulher ? 'deputada' : 'deputado';
	$: Cargo = p.mulher ? 'Deputada' : 'Deputado';

	// The rest of the chamber, for comparisons and the axis; not needed for the first paint
	let todos = [];
	onMount(async () => {
		try {
			const res = await fetch(`${base}/data/perfis/index.json`);
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
		if (v <= 2) return 'Vota como o bloco progressista (PT, PSOL, PCdoB).';
		if (v <= 4) return 'Fica no centro, mais perto do bloco progressista.';
		if (v < 6) return 'Fica no centro do plenário.';
		if (v < 8) return 'Fica no centro, mais perto do bloco conservador.';
		return 'Vota como o bloco conservador (PL, NOVO).';
	}

	$: anos = Object.entries(p.anos ?? {});
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
		x: xPos(d.eixo ?? 5),
		y: 34 + jitter(d.id) * 70,
		meu: d.partido === p.partido,
		eu: d.id === p.id
	}));

	const limpa = (texto = '') => texto.replace(/\s*Sim:\s*\d+.*$/s, '').trim();
	let mostrarTodas = false;
	$: divergencias = mostrarTodas ? p.divergencias : p.divergencias.slice(0, 8);
	const corVoto = (v) => COR[v] ?? 'var(--color-dark)';
</script>

<svelte:head>
	<title>{p.nome} ({p.partido}-{p.uf}): como vota · Voto a voto</title>
	<meta
		name="description"
		content={`Como ${art} ${cargo} ${p.nome} (${p.partido}-${p.uf}) vota na Câmara: presença, alinhamento com o governo e com o partido, e onde fica entre progressistas e conservadores.`}
	/>
</svelte:head>

<main class="pagina">
	<nav class="trilha">
		<a href={`${base}/`}>← Votações</a>
		<a href={`${base}/deputados`}>Todos os deputados</a>
	</nav>

	<header class="cabeca">
		<span class="foto"><img src={p.foto} alt="" width="120" height="120" /></span>
		<div>
			<p class="ds-label">{Cargo} federal · {p.uf}</p>
			<h1>{p.nome}</h1>
			<p class="sub">
				{p.partido}
				{#if trocouPartido}
					<span class="trocas">
						· antes {p.partidos.slice(0, -1).map((x) => x.sigla).join(', ')}
					</span>
				{/if}
			</p>
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
				<p class="comp">Câmara {num(comp.presenca.camara)}% · {p.partido} {num(comp.presenca.partido)}%</p>
			{/if}
		</div>
		<div class="kpi">
			<dt>Com o governo</dt>
			<dd>{num(p.governismo)}<small>{p.governismo == null ? '' : '%'}</small></dd>
			<p>{leituraGoverno(p.governismo)}</p>
			{#if p.governismo != null && comp.governismo.camara != null}
				<p class="comp">Câmara {num(comp.governismo.camara)}% · {p.partido} {num(comp.governismo.partido)}%</p>
			{/if}
		</div>
		<div class="kpi">
			<dt>Com o partido</dt>
			<dd>{num(p.fidelidade)}<small>%</small></dd>
			<p>{leituraPartido(p.fidelidade)}</p>
			{#if comp.fidelidade.camara != null}
				<p class="comp">Câmara {num(comp.fidelidade.camara)}% · {p.partido} {num(comp.fidelidade.partido)}%</p>
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

	<section class="sec">
		<hr class="regua" />
		<p class="ds-label">01 · Posição</p>
		<h2>Onde {art} {cargo} fica no plenário</h2>
		<p class="lead">
			Cada ponto é um deputado ou deputada, posicionado só pelo que votou. Quem vota junto fica perto. Em escuro, o
			{p.partido}.
		</p>
		<div class="eixo" bind:clientWidth={largura}>
			<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${p.nome} na posição ${num(p.eixo, 1)} de 10`}>
				<line x1={M} x2={W - M} y1={118} y2={118} class="eixo-linha" />
				{#each pontos as d}
					{#if !d.eu}
						<circle cx={d.x} cy={d.y} r={raio} class:meu={d.meu} class="ponto" />
					{/if}
				{/each}
				{#if comp.eixo.partido != null}
					<line x1={xPos(comp.eixo.partido)} x2={xPos(comp.eixo.partido)} y1="24" y2="118" class="media-partido" />
				{/if}
				<line x1={xPos(p.eixo)} x2={xPos(p.eixo)} y1="14" y2="118" class="eu-linha" />
				<circle cx={xPos(p.eixo)} cy="14" r="9" class="eu" />
			</svg>
			<div class="eixo-rotulos">
				<span>← progressista</span>
				<span>conservador →</span>
			</div>
		</div>
	</section>

	{#if anos.length > 1}
		<section class="sec">
			<hr class="regua" />
			<p class="ds-label">02 · Ano a ano</p>
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
		<p class="ds-label">{anos.length > 1 ? '03' : '02'} · Votos</p>
		<h2>Como votou</h2>
		<div class="barra" role="img" aria-label={Object.entries(p.contagem).map(([t, n]) => `${t}: ${n}`).join(', ')}>
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
			<p class="ds-label">{anos.length > 1 ? '04' : '03'} · Contra o partido</p>
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
							<span><i style={`background:${corVoto(d.voto)}`} />{art === 'a' ? 'Ela' : 'Ele'}: <b>{d.voto}</b></span>
							<span>{d.porOrientacao ? 'Partido orientou' : 'Maioria do partido'}: <b>{d.partido}</b></span>
							{#if d.governo}<span>Governo: <b>{d.governo}</b></span>{/if}
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

	<section class="sec metodo">
		<hr class="regua" />
		<p class="ds-label">Como calculamos</p>
		<ul>
			<li>
				<b>Base:</b> as votações nominais do plenário da Câmara nesta legislatura (desde fevereiro de 2023), voto a
				voto, com dados da API de Dados Abertos da Câmara.
			</li>
			<li>
				<b>Presença:</b> votos registrados sobre as votações realizadas entre o primeiro e o último voto d{art}
				{cargo}. Suplentes só contam o período em que estavam no cargo.
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
				<b>Progressista → conservador:</b> uma escala estatística que coloca cada deputado conforme com quem vota
				junto, sem classificar votação por votação. Os extremos são definidos pelos blocos que votam de forma mais
				oposta, PT e PSOL de um lado, PL e NOVO do outro. Nesta legislatura esse eixo também separa governo e
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
		padding: calc(var(--grid) * 3) 0 calc(var(--grid) * 8);
	}

	.trilha {
		display: flex;
		justify-content: space-between;
		gap: calc(var(--grid) * 2);
		font-size: var(--t-small);
		font-weight: 600;
		margin-bottom: calc(var(--grid) * 4);
	}

	.trilha a {
		color: var(--color-dark);
		text-decoration: none;
	}

	.trilha a:hover {
		color: var(--accent-amber-ink);
	}

	.cabeca {
		display: flex;
		gap: calc(var(--grid) * 3);
		align-items: center;
	}

	.foto {
		flex: 0 0 auto;
		width: 120px;
		height: 120px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--vote-ausentes);
	}

	.foto img {
		width: 100%;
		height: 100%;
		object-fit: cover;
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
		margin-top: calc(var(--grid) * 7);
	}

	.regua {
		border: 0;
		border-top: 1px solid var(--color-rule);
		margin: 0 0 calc(var(--grid) * 3);
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

	.barra {
		display: flex;
		gap: 2px;
		height: calc(var(--grid) * 2.4);
		border-radius: 999px;
		overflow: hidden;
	}

	.barra i {
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
		margin-top: calc(var(--grid) * 2);
		font: inherit;
		font-size: var(--t-small);
		font-weight: 600;
		padding: 8px 18px;
		border: 1px solid var(--color-dark);
		border-radius: 999px;
		background: none;
		color: var(--color-dark);
		cursor: pointer;
	}

	.mais:hover {
		background: var(--color-dark);
		color: var(--color-light);
	}

	.votos {
		grid-column: 2;
		display: flex;
		flex-wrap: wrap;
		gap: 4px calc(var(--grid) * 2);
		font-size: var(--t-small);
		color: var(--color-text-muted);
	}

	.votos b {
		color: var(--color-dark);
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
		.kpis {
			grid-template-columns: repeat(2, 1fr);
			gap: calc(var(--grid) * 3) calc(var(--grid) * 2);
		}

		.kpi dd {
			font-size: calc(var(--grid) * 4.6);
		}
	}

	@media (max-width: 520px) {
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
