<script>
	import { base } from '$app/paths';
	import { countUp, emVista, reveal } from '$lib/motion.js';
	import Navegacao from './Navegacao.svelte';

	export let data;
	/** 'camara' or 'senado' */
	export let casa = 'camara';

	// What changes between the houses: names, the people, the link at the end and the notes on the data
	const TEXTOS = {
		camara: {
			nome: 'Câmara dos Deputados',
			a: 'a Câmara',
			A: 'A Câmara',
			pessoas: 'deputados',
			Pessoas: 'Deputados',
			lista: '/deputados',
			listaTxt: 'Veja como cada deputado vota →',
			descricao:
				'Quanto o plenário da Câmara seguiu a orientação do governo, de Lula 1 a Lula 3: adesão, vitórias e o tamanho da base fiel de cada presidente.',
			notaSerie:
				'Os pontos são os meses isolados; a linha, a média. As faixas marcam cada governo (no celular, pelas iniciais: L1 é Lula 1, D2 é Dilma 2, T é Temer, B é Bolsonaro). Antes de 2015 a Câmara registrava a orientação do governo em menos votações, por isso os pontos espalham mais.',
			fonte: 'votações nominais do plenário da Câmara com orientação do líder do governo, nos arquivos anuais de dados abertos da Câmara. Orientação liberada fica de fora.',
			vitoria: 'a matéria foi aprovada quando o governo orientou sim, ou rejeitada quando orientou não.',
			governos: 'pela data da posse. Dilma 2 vai até o afastamento, em 12 de maio de 2016, quando começa Temer.'
		},
		senado: {
			nome: 'Senado Federal',
			a: 'o Senado',
			A: 'O Senado',
			pessoas: 'senadores',
			Pessoas: 'Senadores',
			lista: '/senadores',
			listaTxt: 'Veja como cada senador vota →',
			descricao:
				'Quanto o plenário do Senado seguiu a orientação do governo, de Bolsonaro a Lula 3: adesão, vitórias e o tamanho da base fiel de cada presidente.',
			notaSerie:
				'Os pontos são os meses isolados; a linha, a média. As faixas marcam cada governo (no celular, B é Bolsonaro e L3 é Lula 3). O Senado só publica a orientação das lideranças, com o voto de cada senador, a partir de fevereiro de 2019, por isso a série começa ali.',
			fonte: 'votações nominais do plenário do Senado com orientação do líder do governo, nos dados abertos do Senado (orientação das bancadas, desde fevereiro de 2019). Ficam de fora a orientação liberada, as votações secretas e as sessões do Congresso, como as de vetos.',
			vitoria: 'a matéria foi aprovada quando o governo orientou sim, ou rejeitada quando orientou não. O Senado não publica o resultado nessa base, então ele sai do placar: emenda constitucional precisa de 49 votos sim, lei complementar de 41 e o resto de maioria simples.',
			governos: 'pela data da posse. Bolsonaro começa em fevereiro de 2019, primeiro mês com orientações publicadas.'
		}
	};
	$: K = TEXTOS[casa] ?? TEXTOS.camara;
	$: indice = data.indice;
	$: governos = indice.governos ?? [];
	$: meses = indice.meses ?? [];

	const num = (v, c = 0) =>
		v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
	const pct = (v) => (v == null ? '—' : `${num(v)}%`);
	const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
	const mesTxt = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;
	const ano = (d) => d?.slice(0, 4);
	const periodo = (g) => (g.ate ? `${ano(g.de)}–${ano(g.ate)}` : `desde ${ano(g.de)}`);

	// The government picked for the detail section; the current one by default
	let escolhido = null;
	$: atual = governos.find((g) => g.chave === escolhido) ?? governos[governos.length - 1];
	function escolher(chave) {
		escolhido = chave;
		document.getElementById('dentro')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// ---- Month by month: a line smoothed over five months, weighted by the number of roll calls
	let larguraSerie = 0;
	const ALTURA = 260;
	const M = { t: 30, r: 8, b: 26, l: 34 };
	const idx = (m) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
	$: inicio = meses.length ? idx(governos[0]?.de ?? meses[0][0]) : 0;
	$: fim = meses.length ? Math.max(idx(meses[meses.length - 1][0]), idx(new Date().toISOString().slice(0, 7))) : 1;
	$: W = Math.max(280, larguraSerie);
	$: x = (i) => M.l + ((i - inicio + 0.5) / (fim - inicio + 1)) * (W - M.l - M.r);
	// From 20%: no government fell below that in a month with several votes, and the dips stay readable
	const PISO = 20;
	const y = (v) => M.t + (1 - (Math.max(PISO, v) - PISO) / (100 - PISO)) * (ALTURA - M.t - M.b);
	// Band labels: the full name when it fits, else a short code
	const CURTO = { lula1: 'L1', lula2: 'L2', dilma1: 'D1', dilma2: 'D2', temer: 'T', bolsonaro: 'B', lula3: 'L3' };
	$: suave = meses.map(([m], i) => {
		let s = 0;
		let p = 0;
		for (let j = Math.max(0, i - 2); j <= Math.min(meses.length - 1, i + 2); j += 1) {
			if (Math.abs(idx(meses[j][0]) - idx(m)) > 2 || meses[j][1] == null) continue;
			s += meses[j][1] * meses[j][2];
			p += meses[j][2];
		}
		return p ? s / p : null;
	});
	// Break the line where the plenary went more than three months without an oriented vote
	$: caminho = meses
		.map(([m], i) => {
			if (suave[i] == null) return '';
			const salto = i === 0 || idx(m) - idx(meses[i - 1][0]) > 3;
			return `${salto ? 'M' : 'L'}${x(idx(m)).toFixed(1)},${y(suave[i]).toFixed(1)}`;
		})
		.join('');
	$: faixasGov = governos.map((g, i) => {
		const a = x(idx(g.de) - 0.5);
		const b = x(Math.min(fim, idx(g.ate ?? new Date().toISOString().slice(0, 7))) + 0.5);
		const cabe = (t) => t.length * 7 + 8 <= b - a;
		return { ...g, a, b, par: i % 2 === 0, rotulo: cabe(g.nome) ? g.nome : cabe(CURTO[g.chave]) ? CURTO[g.chave] : '' };
	});
	$: anosEixo = (() => {
		const out = [];
		const passo = W < 560 ? 4 : 2;
		for (let a = Math.ceil(inicio / 12); a * 12 <= fim; a += 1) if (a % passo === 0) out.push(a);
		return out;
	})();

	let foco = null;
	function mover(e) {
		const r = e.currentTarget.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * W;
		let melhor = null;
		let dist = Infinity;
		meses.forEach(([m], i) => {
			const d = Math.abs(x(idx(m)) - px);
			if (d < dist) {
				dist = d;
				melhor = i;
			}
		});
		foco = melhor;
	}

	// ---- Inside one government: how many deputies followed it, decile by decile
	const corFaixa = (i) => (i >= 8 ? 'var(--vote-sim)' : i < 4 ? 'var(--vote-nao)' : 'var(--vote-abstencao)');
	$: maxFaixa = Math.max(1, ...(atual?.faixas ?? [1]));
</script>

<svelte:head>
	<title>Governabilidade: quanto {K.a} segue cada governo · Voto a voto</title>
	<meta name="description" content={K.descricao} />
</svelte:head>

<main class="pagina">
	<div class="topo-nav"><Navegacao {casa} secao="governabilidade" /></div>

	<p class="ds-label entra">{K.nome} · {ano(governos[0]?.de)} a {new Date().getFullYear()}</p>
	<h1 class="entra-leve" style="--d:60ms">Quanto {K.a} segue cada governo</h1>
	<p class="lead entra-leve" style="--d:120ms">
		Em cada votação nominal, o líder do governo orienta a bancada a votar sim ou não. Aqui está quantas vezes
		os {K.pessoas} seguiram essa orientação, presidente a presidente, em {num(governos.reduce((s, g) => s + g.votacoes, 0))}
		votações do plenário.
	</p>

	<section class="sec aguarda-vista" use:emVista use:reveal>
		<hr class="regua desenha" />
		<p class="ds-label">01 · Comparação</p>
		<h2>Governo a governo</h2>
		<p class="sub">Toque num governo para ver como {K.a} se dividiu nele.</p>

		<div class="tabela-gov" role="table" aria-label="Governabilidade por governo">
			<div class="linha cab" role="row">
				<span role="columnheader">Governo</span>
				<span role="columnheader">Votos com o governo</span>
				<span role="columnheader">Vitórias do governo</span>
				<span role="columnheader">Base fiel</span>
			</div>
			{#each governos as g, i (g.chave)}
				<button type="button" style={`--i:${i}`} class="linha" class:ativa={atual?.chave === g.chave} role="row" on:click={() => escolher(g.chave)}>
					<span class="gov" role="cell">
						<b>{g.nome}</b>
						<small>{periodo(g)} · {num(g.votacoes)} votações</small>
					</span>
					<span class="metrica" role="cell" data-rotulo="Com o governo">
						<span class="trilho"><i class="cresce-x" style={`width:${g.adesao ?? 0}%`} /></span>
						<b><span use:countUp={g.adesao ?? 0}>{num(g.adesao)}</span>%</b>
					</span>
					<span class="metrica" role="cell" data-rotulo="Vitórias">
						<span class="trilho"><i class="cresce-x" style={`width:${g.taxaVitoria ?? 0}%`} /></span>
						<b><span use:countUp={g.taxaVitoria ?? 0}>{num(g.taxaVitoria)}</span>%</b>
					</span>
					<span class="metrica" role="cell" data-rotulo="Base fiel">
						<span class="trilho"><i class="cresce-x" style={`width:${g.base ?? 0}%`} /></span>
						<b><span use:countUp={g.base ?? 0}>{num(g.base)}</span>%</b>
					</span>
				</button>
			{/each}
		</div>
		<p class="nota">
			<b>Votos com o governo:</b> parte de todos os votos dados que seguiu a orientação. <b>Vitórias:</b> votações em
			que o resultado foi o que o governo orientou. <b>Base fiel:</b> {K.pessoas} que seguiram o governo em 80% ou mais das
			votações, entre os que votaram ao menos {indice.minVotos ?? 20} vezes naquele governo.
		</p>
	</section>

	<section class="sec aguarda-vista" use:emVista use:reveal>
		<hr class="regua desenha" />
		<p class="ds-label">02 · Mês a mês</p>
		<h2>Como a adesão subiu e caiu</h2>
		<p class="sub">Parte dos votos que seguiu o governo, em média móvel de cinco meses. Passe o dedo ou o mouse na linha.</p>

		<figure class="serie" bind:clientWidth={larguraSerie}>
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<svg viewBox={`0 0 ${W} ${ALTURA}`} width={W} height={ALTURA} on:pointermove={mover} on:pointerleave={() => (foco = null)} role="img" aria-label="Adesão ao governo mês a mês">
				{#each faixasGov as f}
					<rect x={f.a} y={M.t - 22} width={Math.max(0, f.b - f.a)} height={ALTURA - M.t - M.b + 22} class="banda" class:par={f.par} />
					{#if f.rotulo}
						<text x={f.a + 4} y={M.t - 8} class="rot-gov">{f.rotulo}</text>
					{/if}
				{/each}
				{#each [25, 50, 75, 100] as v}
					<line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} class:meio={v === 50} class="grade" />
					<text x={M.l - 6} y={y(v) + 4} class="rot-y">{v}%</text>
				{/each}
				{#each anosEixo as a}
					<text x={x(a * 12)} y={ALTURA - 6} class="rot-x">{a}</text>
				{/each}
				{#each meses as [m, v], i}
					{#if v != null}<circle cx={x(idx(m))} cy={y(v)} r="1.6" class="ponto" />{/if}
				{/each}
				<path d={caminho} class="linha-serie" pathLength="1" />
				{#if foco != null && suave[foco] != null}
					<line x1={x(idx(meses[foco][0]))} x2={x(idx(meses[foco][0]))} y1={M.t} y2={ALTURA - M.b} class="foco" />
					<circle cx={x(idx(meses[foco][0]))} cy={y(meses[foco][1] ?? suave[foco])} r="5" class="foco-ponto" />
				{/if}
			</svg>
			{#if foco != null}
				{@const fx = x(idx(meses[foco][0]))}
				<div
					class="tip dica"
					class:esq={fx < W / 3}
					class:dir={fx > (W * 2) / 3}
					style={`left:${fx}px;top:${Math.min(y(meses[foco][1] ?? suave[foco]), y(suave[foco]))}px`}
				>
					<span class="dica-rotulo">{mesTxt(meses[foco][0])} · {governos.find((g) => meses[foco][0] >= g.de.slice(0, 7) && (!g.ate || meses[foco][0] <= g.ate.slice(0, 7)))?.nome ?? ''}</span>
					<span class="dica-valor">{pct(meses[foco][1])}<small>dos votos com o governo</small></span>
					<span class="dica-linha"><i class="ponto" style="background:var(--vote-sim)" />Média de cinco meses: <b>{pct(suave[foco])}</b></span>
					<span class="dica-linha">{num(meses[foco][2])} {meses[foco][2] === 1 ? 'votação' : 'votações'} no mês</span>
				</div>
			{/if}
		</figure>
		<p class="nota">{K.notaSerie}</p>
	</section>

	{#if atual}
		<section class="sec aguarda-vista" id="dentro" use:emVista use:reveal>
			<hr class="regua desenha" />
			<p class="ds-label">03 · Dentro de cada governo</p>
			<h2>Quem seguiu {atual.nome}</h2>

			<div class="escolha" role="tablist" aria-label="Governo">
				{#each governos as g (g.chave)}
					<button type="button" role="tab" aria-selected={atual.chave === g.chave} class:ativo={atual.chave === g.chave} on:click={() => (escolhido = g.chave)}>
						{g.nome}
					</button>
				{/each}
			</div>

			<p class="sub">
				{atual.presidente}, {periodo(atual)}. Dos {num(atual.deputados)} {K.pessoas} com ao menos {indice.minVotos ?? 20} votos,
				<b>{pct(atual.base)}</b> seguiram o governo em 80% ou mais das votações e <b>{pct(atual.oposicao)}</b> em menos de 40%.
			</p>

			<div class="duas">
				<figure>
					<figcaption class="titulo-fig">{K.Pessoas} por parte dos votos com o governo</figcaption>
					<div class="histo" aria-hidden="true">
						{#each atual.faixas as n, i}
							<span class="col">
								<em class="aparece" style={`--d:${300 + i * 14}ms`}>{n || ''}</em>
								<i class="cresce-y" style={`height:${(n / maxFaixa) * 100}%;background:${corFaixa(i)};--i:${i}`} />
							</span>
						{/each}
					</div>
					<div class="eixo-histo"><span>0%</span><span>50%</span><span>100%</span></div>
					<div class="legenda">
						<span><i style="background:var(--vote-nao)" />Oposição, menos de 40%</span>
						<span><i style="background:var(--vote-abstencao)" />No meio</span>
						<span><i style="background:var(--vote-sim)" />Base, 80% ou mais</span>
					</div>
				</figure>

				<figure>
					<figcaption class="titulo-fig">Votos com o governo, por partido</figcaption>
					<ul class="partidos">
						{#each atual.partidos as p, i (p.sigla)}
							<li>
								<span class="sigla">{p.sigla}</span>
								<span class="trilho"><i class="cresce-x" style={`width:${p.adesao}%;background:${corFaixa(Math.min(9, Math.floor(p.adesao / 10)))};--i:${i}`} /></span>
								<b>{pct(p.adesao)}</b>
							</li>
						{/each}
					</ul>
					<p class="nota">Os doze partidos com mais votos no período. A sigla é a do partido na data do voto.</p>
				</figure>
			</div>
		</section>
	{/if}

	<section class="sec metodo" use:reveal>
		<hr class="regua desenha" />
		<p class="ds-label">Como calculamos</p>
		<ul>
			<li><b>Base:</b> {K.fonte}</li>
			<li><b>Seguir o governo:</b> votar sim quando o governo orientou sim; votar não ou obstruir quando orientou não ou obstrução. Abstenção conta como não seguir.</li>
			<li><b>Vitória:</b> {K.vitoria}</li>
			<li><b>Governos:</b> {K.governos}</li>
			<li>Os números não medem o mérito das votações nem quantas matérias o governo conseguiu pautar, só o comportamento do plenário quando houve voto nominal.</li>
		</ul>
	</section>

	<p class="rodape"><a href={`${base}${K.lista}`}>{K.listaTxt}</a></p>
</main>

<style>
	.pagina {
		width: calc(100% - var(--grid) * 4);
		max-width: 980px;
		margin: 0 auto;
		padding: calc(var(--grid) * 3) 0 calc(var(--grid) * 8);
	}

	.topo-nav {
		margin-bottom: calc(var(--grid) * 4);
	}

	.rodape a {
		color: var(--color-dark);
		text-decoration: none;
	}

	h1 {
		font-size: clamp(calc(var(--grid) * 4), 6vw, calc(var(--grid) * 7));
		line-height: 1.02;
		letter-spacing: -0.02em;
		margin: calc(var(--grid) * 0.6) 0 calc(var(--grid) * 1.5);
		max-width: 16ch;
	}

	.lead {
		color: var(--color-text-muted);
		max-width: 62ch;
		margin: 0;
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
		font-size: calc(var(--grid) * 3.4);
		line-height: 1.12;
		margin: 0 0 calc(var(--grid) * 1.2);
	}

	.sub {
		color: var(--color-text-muted);
		max-width: 62ch;
		margin: 0 0 calc(var(--grid) * 3);
	}

	.sub b {
		color: var(--color-dark);
	}

	.nota {
		font-size: var(--t-small);
		color: var(--color-text-muted);
		max-width: 70ch;
		margin: calc(var(--grid) * 2) 0 0;
	}

	.nota b {
		color: var(--color-dark);
	}

	/* ---- Government by government */
	.linha {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) repeat(3, minmax(0, 1fr));
		gap: calc(var(--grid) * 3);
		align-items: center;
		width: 100%;
		padding: calc(var(--grid) * 1.4) 0;
		border: 0;
		border-top: 1px solid var(--color-rule);
		background: none;
		color: var(--color-dark);
		font: inherit;
		font-size: var(--t-small);
		text-align: left;
		cursor: pointer;
		transition: background-color 180ms var(--ease);
	}

	button.linha:hover {
		background: color-mix(in srgb, var(--accent-amber) 8%, transparent);
	}

	button.linha.ativa .gov b {
		text-decoration: underline 2px var(--accent-amber);
		text-underline-offset: 4px;
	}

	.cab {
		border-top: 0;
		padding-top: 0;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: default;
	}

	.gov {
		display: flex;
		flex-direction: column;
	}

	.gov b {
		font-family: var(--font-display);
		font-size: calc(var(--grid) * 2.6);
		font-weight: 500;
		line-height: 1.15;
	}

	.gov small {
		font-size: var(--t-mini);
		color: var(--color-text-muted);
	}

	.metrica {
		display: flex;
		align-items: center;
		gap: calc(var(--grid) * 1.2);
		font-variant-numeric: tabular-nums;
	}

	.metrica b {
		min-width: 4ch;
		text-align: right;
		font-weight: 600;
	}

	.trilho {
		position: relative;
		flex: 1;
		display: block;
		height: var(--barra-espessura);
		border-radius: 999px;
		background: var(--color-track);
		overflow: hidden;
	}

	.trilho i {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--vote-sim);
		transition: width 360ms var(--ease);
	}

	/* ---- Month by month */
	.serie {
		position: relative;
		margin: 0;
		touch-action: pan-y;
	}

	.serie svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.banda {
		fill: transparent;
	}

	.banda.par {
		fill: color-mix(in srgb, var(--color-dark) 4%, transparent);
	}

	.rot-gov {
		font-size: var(--t-mini);
		font-weight: 600;
		fill: var(--color-dark);
	}

	.grade {
		stroke: var(--color-rule);
	}

	.grade.meio {
		stroke-dasharray: 3 3;
		stroke: color-mix(in srgb, var(--color-dark) 35%, transparent);
	}

	.rot-y,
	.rot-x {
		font-size: var(--t-mini);
		fill: var(--color-text-muted);
	}

	.rot-y {
		text-anchor: end;
	}

	.rot-x {
		text-anchor: middle;
	}

	.ponto {
		fill: var(--vote-nao);
	}

	/* The line draws itself from 2003 to now when the chart comes into view */
	.linha-serie {
		stroke-dasharray: 1;
		animation: traca 1600ms var(--ease) backwards 200ms;
		fill: none;
		stroke: var(--vote-sim);
		stroke-width: 2.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	@keyframes traca {
		from {
			stroke-dashoffset: 1;
		}
	}

	.ponto {
		animation: aparece 600ms var(--ease) backwards 900ms;
	}

	.serie svg {
		cursor: crosshair;
	}

	.foco {
		stroke: var(--color-dark);
		stroke-opacity: 0.4;
	}

	.foco-ponto {
		fill: var(--accent-amber);
		stroke: var(--color-light);
		stroke-width: 2;
	}

	.tip {
		position: absolute;
		transform: translate(-50%, calc(-100% - 14px));
		z-index: 5;
	}


	.tip.esq {
		--seta-x: 16px;
		transform: translate(-16px, calc(-100% - 14px));
	}

	.tip.dir {
		--seta-x: calc(100% - 16px);
		transform: translate(calc(-100% + 16px), calc(-100% - 14px));
	}

	/* ---- Inside one government */
	.escolha {
		display: flex;
		gap: calc(var(--grid) * 0.8);
		overflow-x: auto;
		scrollbar-width: none;
		margin: 0 0 calc(var(--grid) * 2.5);
		padding: 2px 0;
	}

	.escolha::-webkit-scrollbar {
		display: none;
	}

	.escolha button {
		flex: 0 0 auto;
		padding: calc(var(--grid) * 0.6) calc(var(--grid) * 1.4);
		border: 1px solid var(--color-dark);
		border-radius: 999px;
		background: transparent;
		color: var(--color-dark);
		font: inherit;
		font-size: var(--t-control);
		font-weight: 500;
		cursor: pointer;
		transition: background-color 180ms var(--ease), color 180ms var(--ease);
	}

	.escolha button:hover,
	.escolha button.ativo {
		background: var(--color-dark);
		color: var(--color-light);
	}

	.duas {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: calc(var(--grid) * 6);
	}

	.duas figure {
		margin: 0;
	}

	.titulo-fig {
		font-size: var(--t-small);
		font-weight: 600;
		margin-bottom: calc(var(--grid) * 2);
	}

	/* Ten columns close together: just wide enough for the counts above them */
	.histo,
	.eixo-histo {
		max-width: calc(var(--grid) * 36);
	}

	.histo {
		display: flex;
		align-items: flex-end;
		gap: 3px;
		height: calc(var(--grid) * 20);
		border-bottom: 1px solid var(--color-dark);
	}

	.histo .col {
		flex: 1;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
	}

	.histo em {
		font-style: normal;
		font-size: var(--t-mini);
		text-align: center;
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.histo i {
		display: block;
		width: var(--barra-espessura);
		min-height: 2px;
		border-radius: var(--raio-coluna);
		transition: height 360ms var(--ease);
	}

	.eixo-histo {
		display: flex;
		justify-content: space-between;
		margin-top: calc(var(--grid) * 0.6);
		font-size: var(--t-mini);
		color: var(--color-text-muted);
	}

	.legenda {
		display: flex;
		flex-wrap: wrap;
		gap: calc(var(--grid) * 0.6) calc(var(--grid) * 2);
		margin-top: calc(var(--grid) * 1.6);
		font-size: var(--t-mini);
		color: var(--color-text-muted);
	}

	.legenda span {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--grid) * 0.6);
	}

	.legenda i {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.partidos {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.partidos li {
		display: grid;
		grid-template-columns: 11ch minmax(0, 1fr) 4ch;
		gap: calc(var(--grid) * 1.2);
		align-items: center;
		padding: calc(var(--grid) * 0.6) 0;
		border-top: 1px solid var(--color-rule);
		font-size: var(--t-small);
		font-variant-numeric: tabular-nums;
	}

	.sigla {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.partidos b {
		text-align: right;
		font-weight: 600;
	}

	.metodo ul {
		margin: 0;
		padding-left: 1.1em;
		max-width: 70ch;
		font-size: var(--t-small);
		color: var(--color-text-muted);
	}

	.metodo li {
		margin-bottom: calc(var(--grid) * 1);
	}

	.metodo b {
		color: var(--color-dark);
	}

	.rodape {
		margin-top: calc(var(--grid) * 6);
		font-weight: 500;
	}

	.rodape a {
		border-bottom: 2px solid var(--accent-amber);
	}

	@media (max-width: 600px) {
		h2 {
			font-size: calc(var(--grid) * 2.6);
		}

		.sec {
			margin-top: calc(var(--grid) * 7);
		}

		.cab {
			display: none;
		}

		.linha {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: calc(var(--grid) * 1) calc(var(--grid) * 2);
		}

		.gov {
			grid-column: 1 / -1;
		}

		.metrica {
			flex-direction: column;
			align-items: stretch;
			gap: 2px;
		}

		.metrica::before {
			content: attr(data-rotulo);
			font-size: var(--t-mini);
			color: var(--color-text-muted);
			white-space: nowrap;
		}

		.metrica b {
			order: -1;
			text-align: left;
		}

		.metrica .trilho {
			flex: none;
			order: 1;
		}

		.duas {
			grid-template-columns: 1fr;
			gap: calc(var(--grid) * 5);
		}

		.histo {
			height: calc(var(--grid) * 16);
			gap: 2px;
		}
	}
</style>
