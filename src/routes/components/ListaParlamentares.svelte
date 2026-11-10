<script>
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import Select from './ui/Select.svelte';

	export let data;
	/** 'camara' or 'senado' */
	export let casa = 'camara';

	const CASAS = {
		camara: {
			rota: 'deputado',
			nome: 'Câmara dos Deputados',
			titulo: 'Deputados',
			h1: 'Como cada deputado vota',
			pessoas: 'deputados e deputadas',
			pessoasCurto: 'deputados',
			descricao: 'cada deputado e deputada federal'
		},
		senado: {
			rota: 'senador',
			nome: 'Senado Federal',
			titulo: 'Senadores',
			h1: 'Como cada senador vota',
			pessoas: 'senadores e senadoras',
			pessoasCurto: 'senadores',
			descricao: 'cada senador e senadora'
		}
	};
	$: K = CASAS[casa];
	$: indice = data.indice;

	let busca = '';
	let partido = '';
	let ordem = 'nome';
	let faixa = '';

	// Where the plenary splits on the 0–10 axis: the left bloc, the centrão, the right bloc
	const FAIXAS = [
		{ chave: 'prog', rotulo: 'Progressistas', campo: 'campo progressista', de: 0, ate: 2, cor: 'var(--vote-sim)' },
		{ chave: 'centro', rotulo: 'Centro', campo: 'centro', de: 2, ate: 6, cor: 'var(--vote-abstencao)' },
		{ chave: 'cons', rotulo: 'Conservadores', campo: 'campo conservador', de: 6, ate: 10.01, cor: 'var(--accent-amber-ink)' }
	];
	const faixaDe = (e) => FAIXAS.find((f) => e >= f.de && e < f.ate) ?? FAIXAS[2];
	// Which parties sit in each field, by where the party's average falls, biggest first
	$: notas = (() => {
		const porPartido = new Map();
		for (const d of indice.deputados) {
			if (!porPartido.has(d.partido)) porPartido.set(d.partido, []);
			porPartido.get(d.partido).push(d.eixo);
		}
		const out = { prog: [], centro: [], cons: [] };
		[...porPartido]
			.filter(([p]) => p && !/^s\/?part/i.test(p))
			.sort((a, b) => b[1].length - a[1].length)
			.forEach(([p, xs]) => out[faixaDe(xs.reduce((s, x) => s + x, 0) / xs.length).chave].push(p));
		return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.slice(0, 5).join(', ')]));
	})();
	const BINS = 40;
	let focoBin = null;
	$: contagemFaixa = Object.fromEntries(FAIXAS.map((f) => [f.chave, indice.deputados.filter((d) => faixaDe(d.eixo).chave === f.chave).length]));
	$: histograma = Array.from({ length: BINS }, (_, i) => {
		const de = (i * 10) / BINS;
		const n = indice.deputados.filter((d) => Math.min(BINS - 1, Math.floor((d.eixo / 10) * BINS)) === i).length;
		return { i, de, n, faixa: faixaDe(de + 0.001) };
	});
	$: maxBin = Math.max(1, ...histograma.map((b) => b.n));
	function escolherFaixa(chave) {
		faixa = faixa === chave ? '' : chave;
	}
	function abrir(evento, d) {
		if (evento.target.closest('a')) return;
		goto(`${base}/${K.rota}/${d.slug}`);
	}

	const ORDENS = {
		nome: { rotulo: 'Nome', fn: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR') },
		nomeZ: { rotulo: 'Nome, de Z a A', fn: (a, b) => b.nome.localeCompare(a.nome, 'pt-BR') },
		presencaMaior: { rotulo: 'Maior presença', fn: (a, b) => (b.presenca ?? -1) - (a.presenca ?? -1) },
		fieis: { rotulo: 'Mais fiéis ao partido', fn: (a, b) => (b.fidelidade ?? -1) - (a.fidelidade ?? -1) },
		governismo: { rotulo: 'Mais governistas', fn: (a, b) => (b.governismo ?? -1) - (a.governismo ?? -1) },
		oposicao: { rotulo: 'Mais de oposição', fn: (a, b) => (a.governismo ?? 101) - (b.governismo ?? 101) },
		fidelidade: { rotulo: 'Menos fiéis ao partido', fn: (a, b) => (a.fidelidade ?? 101) - (b.fidelidade ?? 101) },
		presenca: { rotulo: 'Menor presença', fn: (a, b) => (a.presenca ?? 101) - (b.presenca ?? 101) },
		progressista: { rotulo: 'Mais progressistas', fn: (a, b) => a.eixo - b.eixo },
		conservador: { rotulo: 'Mais conservadores', fn: (a, b) => b.eixo - a.eixo },
		gasto: { rotulo: 'Maior gasto da cota', fn: (a, b) => (b.gasto ?? -1) - (a.gasto ?? -1) }
	};

	// Column heads sort the table: the first click puts the most of it on top, the next one flips it
	const COLUNAS = {
		nome: ['nome', 'nomeZ'],
		presenca: ['presencaMaior', 'presenca'],
		governo: ['governismo', 'oposicao'],
		partido: ['fieis', 'fidelidade'],
		prog: ['progressista', 'conservador'],
		cons: ['conservador', 'progressista']
	};
	function ordenarPor(col) {
		const [a, b] = COLUNAS[col];
		ordem = ordem === a ? b : a;
	}
	const ativa = (col, ordem) => COLUNAS[col].includes(ordem) && !(col === 'prog' && ordem === 'conservador') && !(col === 'cons' && ordem === 'progressista');
	const seta = (col, ordem) => (!ativa(col, ordem) ? '' : ordem === COLUNAS[col][0] ? (col === 'nome' ? '↑' : '↓') : col === 'nome' ? '↓' : '↑');
	const ariaSort = (col, ordem) => (!ativa(col, ordem) ? 'none' : seta(col, ordem) === '↑' ? 'ascending' : 'descending');

	const semAcento = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
	$: partidos = [...new Set(indice.deputados.map((d) => d.partido))].sort();
	$: termo = semAcento(busca.trim());
	$: lista = indice.deputados
		.filter((d) => (!faixa || faixaDe(d.eixo).chave === faixa) && (!partido || d.partido === partido) && (!termo || semAcento(`${d.nome} ${d.uf}`).includes(termo)))
		.sort(ORDENS[ordem].fn);
	$: governismoAusente = indice.deputados.every((d) => d.governismo == null);
	$: opcoesPartido = [{ value: '', label: 'Todos os partidos' }, ...partidos.map((p) => ({ value: p, label: p }))];
	$: opcoesOrdem = Object.entries(ORDENS)
		.filter(([chave]) => !(governismoAusente && (chave === 'governismo' || chave === 'oposicao')))
		.map(([value, o]) => ({ value, label: o.rotulo }));

	const num = (v, c = 0) =>
		v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
</script>

<svelte:head>
	<title>{K.titulo}: como cada um vota · Voto a voto</title>
	<meta
		name="description"
		content={`Presença, alinhamento com o governo e com o partido, gastos e posição entre progressistas e conservadores de ${K.descricao}.`}
	/>
</svelte:head>

<main class="pagina">
	<nav class="trilha"><a href={`${base}/`}>← Votações</a></nav>

	<p class="ds-label">{K.nome} · legislatura {indice.legislatura}</p>
	<h1>{K.h1}</h1>
	<p class="lead">
		{num(indice.deputados.length)} {K.pessoas}, a partir de {num(indice.votacoes)} votações nominais
		desde fevereiro de 2023. Escolha um nome para ver o perfil completo.
	</p>

	<figure class="espectro">
		<figcaption class="ds-label">Quantos estão em cada campo</figcaption>
		<div class="faixas">
			{#each FAIXAS as f}
				<button
					type="button"
					class="faixa"
					class:ativa={faixa === f.chave}
					class:apagada={faixa && faixa !== f.chave}
					style={`--cor:${f.cor}`}
					on:click={() => escolherFaixa(f.chave)}
					aria-pressed={faixa === f.chave}
				>
					<span class="n">{contagemFaixa[f.chave]}</span>
					<span class="r">{f.rotulo}</span>
					<span class="p">{num((contagemFaixa[f.chave] / indice.deputados.length) * 100)}% · {notas[f.chave]}</span>
				</button>
			{/each}
		</div>
		<div class="barra-faixas" aria-hidden="true">
			{#each FAIXAS as f}<i style={`flex:${contagemFaixa[f.chave]};background:${f.cor}`} class:apagada={faixa && faixa !== f.chave} />{/each}
		</div>
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="histo" aria-hidden="true" on:pointerleave={() => (focoBin = null)}>
			{#each histograma as b}
				<span
					class="col"
					class:apagada={faixa && faixa !== b.faixa.chave}
					class:foco={focoBin === b}
					on:pointerenter={() => (focoBin = b)}
					on:pointerdown={() => (focoBin = b)}
				>
					<i style={`height:${(b.n / maxBin) * 100}%;background:${b.faixa.cor}`} />
				</span>
			{/each}
			{#if focoBin}
				<span
					class="tip dica"
					class:esq={focoBin.i < 6}
					class:dir={focoBin.i > BINS - 7}
					style={`left:${((focoBin.i + 0.5) / BINS) * 100}%;bottom:${(focoBin.n / maxBin) * 100}%`}
				>
					<span class="dica-rotulo"><i class="ponto" style={`background:${focoBin.faixa.cor}`} />{focoBin.faixa.campo}</span>
					<span class="dica-valor">{num(focoBin.n)}<small>{focoBin.n === 1 ? K.pessoasCurto.replace(/es$/, '').replace(/s$/, '') : K.pessoasCurto}</small></span>
					<span class="dica-linha">de {num(focoBin.de, 2)} a {num(focoBin.de + 10 / BINS, 2)} no eixo</span>
				</span>
			{/if}
		</div>
		<div class="eixo-rot"><span>← Progressista</span><span>0 · 2 · 6 · 10</span><span>Conservador →</span></div>
		<p class="nota">
			Cada barra reúne os {K.pessoasCurto} numa mesma faixa do eixo de 0 a 10, calculado só a partir dos votos. Os
			cortes em 2 e 6 separam onde o plenário de fato se divide. Toque num campo para filtrar a lista.
		</p>
	</figure>

	<div class="filtros">
		<label class="busca">
			<span class="sr">Buscar por nome ou estado</span>
			<input type="search" bind:value={busca} placeholder="Buscar por nome ou estado" autocomplete="off" />
		</label>
		<Select bind:value={partido} options={opcoesPartido} placeholder="" aria-label="Partido" />
		<Select bind:value={ordem} options={opcoesOrdem} placeholder="" aria-label="Ordenar" />
	</div>

	<table class="tabela">
		<thead>
			<tr>
				<th aria-sort={ariaSort('nome', ordem)}>
					<button type="button" class="ordena" class:on={ativa('nome', ordem)} on:click={() => ordenarPor('nome')}>Nome<i>{seta('nome', ordem)}</i></button>
				</th>
				<th class="n" aria-sort={ariaSort('presenca', ordem)}>
					<button type="button" class="ordena" class:on={ativa('presenca', ordem)} on:click={() => ordenarPor('presenca')}>Presença<i>{seta('presenca', ordem)}</i></button>
				</th>
				{#if !governismoAusente}
					<th class="n" aria-sort={ariaSort('governo', ordem)}>
						<button type="button" class="ordena" class:on={ativa('governo', ordem)} on:click={() => ordenarPor('governo')}>Governo<i>{seta('governo', ordem)}</i></button>
					</th>
				{/if}
				<th class="n" aria-sort={ariaSort('partido', ordem)}>
					<button type="button" class="ordena" class:on={ativa('partido', ordem)} on:click={() => ordenarPor('partido')}>Partido<i>{seta('partido', ordem)}</i></button>
				</th>
				<th class="eixo-col">
					<span class="eixo-cab">
						<button type="button" class="ordena" class:on={ordem === 'progressista'} on:click={() => (ordem = 'progressista')} title="Mais progressistas primeiro">Prog.</button>
						<button type="button" class="ordena" class:on={ordem === 'conservador'} on:click={() => (ordem = 'conservador')} title="Mais conservadores primeiro">Cons.</button>
					</span>
				</th>
			</tr>
		</thead>
		<tbody>
			{#each lista as d (d.id)}
				<tr on:click={(e) => abrir(e, d)}>
					<td>
						<a href={`${base}/${K.rota}/${d.slug}`}>
							<span class="foto retrato"><img src={d.foto} alt="" width="44" height="44" loading="lazy" /></span>
							<span class="nome">
								<b>{d.nome}</b>
								<small>{d.partido} · {d.uf}{d.profissao ? ` · ${d.profissao}` : ''}</small>
							</span>
						</a>
					</td>
					<td class="n" data-rotulo="Presença">
						<span class="medida"><span class="mini"><i style={`width:${d.presenca ?? 0}%`} /></span>{num(d.presenca)}%</span>
					</td>
					{#if !governismoAusente}
						<td class="n" data-rotulo="Governo">
							<span class="medida"><span class="mini"><i style={`width:${d.governismo ?? 0}%`} /></span>{d.governismo == null ? '—' : `${num(d.governismo)}%`}</span>
						</td>
					{/if}
					<td class="n" data-rotulo="Partido">
						<span class="medida"><span class="mini"><i style={`width:${d.fidelidade ?? 0}%`} /></span>{num(d.fidelidade)}%</span>
					</td>
					<td class="eixo-col" data-rotulo="Prog. ↔ Cons.">
						<span class="trilho" aria-label={`${num(d.eixo, 1)} de 10`}>
							<span class="meio" />
							<i style={`--x:${d.eixo / 10}`} />
						</span>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{#if !lista.length}<p class="vazio">Nenhum nome encontrado.</p>{/if}
</main>

<style>
	.pagina {
		width: calc(100% - var(--grid) * 4);
		max-width: 980px;
		margin: 0 auto;
		padding: calc(var(--grid) * 3) 0 calc(var(--grid) * 8);
	}

	.trilha {
		font-size: var(--t-small);
		font-weight: 600;
		margin-bottom: calc(var(--grid) * 4);
	}

	.trilha a {
		color: var(--color-dark);
		text-decoration: none;
	}

	h1 {
		font-size: clamp(calc(var(--grid) * 4), 6vw, calc(var(--grid) * 7));
		line-height: 1.02;
		letter-spacing: -0.02em;
		margin: calc(var(--grid) * 0.6) 0 calc(var(--grid) * 1.5);
	}

	.lead {
		color: var(--color-text-muted);
		margin: 0 0 calc(var(--grid) * 3);
	}

	.espectro {
		margin: 0 0 calc(var(--grid) * 4);
	}

	.faixas {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: calc(var(--grid) * 1.2);
		margin: calc(var(--grid) * 1.2) 0;
	}

	.faixa {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: calc(var(--grid) * 1.2) calc(var(--grid) * 1) calc(var(--grid) * 1.2) 0;
		border: 0;
		border-top: 4px solid var(--cor);
		background: none;
		color: var(--color-dark);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: opacity 160ms var(--ease), background 160ms var(--ease);
	}

	.faixa:hover .r,
	.faixa.ativa .r {
		text-decoration: underline 2px var(--cor);
		text-underline-offset: 4px;
	}

	.faixa .n {
		font-family: var(--font-display);
		font-size: clamp(calc(var(--grid) * 3.6), 6vw, calc(var(--grid) * 5.4));
		font-weight: 500;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.faixa .r {
		font-weight: 600;
	}

	.faixa .p {
		font-size: var(--t-small);
		color: var(--color-text-muted);
	}

	.apagada {
		opacity: 0.3;
	}

	.barra-faixas {
		display: flex;
		gap: 2px;
		height: var(--barra-espessura);
		border-radius: var(--raio-barra);
		overflow: hidden;
	}

	.barra-faixas i {
		transition: opacity 160ms var(--ease);
	}

	.histo {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 96px;
		margin-top: calc(var(--grid) * 1.6);
		border-bottom: 1px solid var(--color-dark);
	}

	.histo {
		position: relative;
	}

	.histo .col {
		flex: 1;
		height: 100%;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		cursor: pointer;
		transition: opacity 160ms var(--ease);
	}

	.histo .col.foco i {
		filter: brightness(1.15);
		outline: 2px solid var(--accent-amber);
		outline-offset: 1px;
	}

	/* Placement only: the card itself is .dica, in app.css */
	.tip {
		position: absolute;
		transform: translate(-50%, -14px);
		z-index: 4;
	}


	.tip.esq {
		--seta-x: 16px;
		transform: translate(-16px, -14px);
	}

	.tip.dir {
		--seta-x: calc(100% - 16px);
		transform: translate(calc(-100% + 16px), -14px);
	}

	.histo i {
		display: block;
		width: min(var(--barra-espessura), 100%);
		min-height: 2px;
		border-radius: var(--raio-coluna);
	}

	.eixo-rot {
		display: flex;
		justify-content: space-between;
		margin-top: calc(var(--grid) * 0.6);
		font-size: var(--t-small);
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.eixo-rot span:nth-child(2) {
		visibility: hidden;
	}

	.nota {
		font-size: var(--t-small);
		color: var(--color-text-muted);
		margin: calc(var(--grid) * 1) 0 0;
	}

	tbody tr {
		cursor: pointer;
	}

	tbody tr:hover td {
		background: color-mix(in srgb, var(--accent-amber) 8%, transparent);
	}

	.filtros {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		flex-wrap: wrap;
		gap: calc(var(--grid) * 1);
		padding: calc(var(--grid) * 1.2) 0;
		background: color-mix(in srgb, var(--color-light) 92%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.busca {
		flex: 1 1 220px;
	}

	.filtros :global(.ui-select-wrapper) {
		flex: 1 1 calc(var(--grid) * 22);
	}

	.filtros :global(.ui-select) {
		width: 100%;
	}

	input {
		width: 100%;
		-webkit-appearance: none;
		appearance: none;
		font-family: var(--font-primary);
		font-size: max(16px, var(--t-control));
		font-weight: 500;
		line-height: 1.2;
		padding: calc(var(--grid) * 0.9) calc(var(--grid) * 1.8);
		border: 1px solid var(--color-dark);
		border-radius: 999px;
		background: var(--color-light);
		color: var(--color-dark);
	}

	input:focus {
		outline: 2px solid var(--accent-amber);
		outline-offset: 1px;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	.tabela {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--t-small);
		font-variant-numeric: tabular-nums;
	}

	th {
		text-align: left;
		font-weight: 600;
		color: var(--color-text-muted);
		padding: calc(var(--grid) * 1) 0;
	}

	td {
		border-top: 1px solid var(--color-rule);
		padding: calc(var(--grid) * 0.8) 0;
	}

	.n {
		text-align: right;
		padding-right: calc(var(--grid) * 2);
		white-space: nowrap;
	}

	td a {
		display: flex;
		align-items: center;
		gap: calc(var(--grid) * 1.2);
		color: var(--color-dark);
		text-decoration: none;
	}

	td a:hover b {
		color: var(--accent-amber-ink);
	}

	.foto {
		width: calc(var(--grid) * 4.6);
		height: calc(var(--grid) * 4.6);
		transition: transform 180ms var(--ease);
	}

	tbody tr:hover .foto {
		transform: scale(1.12);
	}

	.nome {
		display: flex;
		flex-direction: column;
	}

	.nome small {
		color: var(--color-text-muted);
	}

	.eixo-col {
		width: 150px;
	}

	.eixo-cab {
		display: flex;
		justify-content: space-between;
	}

	.ordena {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition: color 180ms var(--ease);
	}

	.ordena:hover,
	.ordena.on {
		color: var(--color-dark);
	}

	.ordena.on {
		text-decoration: underline 2px var(--accent-amber);
		text-underline-offset: 5px;
	}

	.ordena i {
		display: inline-block;
		font-style: normal;
		color: var(--accent-amber-ink);
	}

	.ordena i:empty {
		display: none;
	}

	.medida {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: calc(var(--grid) * 0.9);
	}

	.mini {
		display: inline-block;
		width: calc(var(--grid) * 7);
		height: var(--barra-espessura);
		border-radius: 999px;
		background: var(--vote-ausentes);
		overflow: hidden;
	}

	.mini i {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--vote-sim);
	}

	.trilho {
		position: relative;
		display: block;
		height: var(--barra-espessura);
		border-radius: 999px;
		background: var(--vote-ausentes);
	}

	.meio {
		position: absolute;
		left: 50%;
		top: -3px;
		bottom: -3px;
		width: 1px;
		background: var(--color-dark);
		opacity: 0.4;
	}

	.trilho i {
		position: absolute;
		top: 50%;
		/* inset by the dot's radius, so 0 and 10 stay inside the track */
		left: calc(7px + (100% - 14px) * var(--x, 0.5));
		width: 14px;
		height: 14px;
		margin: -7px 0 0 -7px;
		border-radius: 50%;
		background: var(--accent-amber);
		border: 2px solid var(--color-light);
		box-shadow: 0 0 0 1px var(--accent-amber);
	}

	.vazio {
		color: var(--color-text-muted);
	}

	@media (max-width: 600px) {
		thead {
			display: none;
		}

		.tabela,
		.tabela tbody {
			display: block;
		}

		tbody tr {
			display: grid;
			grid-template-columns: repeat(3, auto) minmax(0, 1fr);
			gap: calc(var(--grid) * 0.8) calc(var(--grid) * 2.2);
			padding: calc(var(--grid) * 1.4) 0 calc(var(--grid) * 1.4) calc(var(--grid) * 5.8);
			border-top: 1px solid var(--color-rule);
		}

		tbody tr:hover td {
			background: none;
		}

		td {
			border: 0;
			padding: 0;
		}

		td:first-child {
			grid-column: 1 / -1;
			margin-left: calc(var(--grid) * -5.8);
		}

		td[data-rotulo] {
			display: flex;
			flex-direction: column;
			gap: 2px;
			text-align: left;
			padding-right: 0;
		}

		td[data-rotulo]::before {
			content: attr(data-rotulo);
			font-size: var(--t-mini);
			color: var(--color-text-muted);
			white-space: nowrap;
		}

		.medida {
			justify-content: flex-start;
			font-weight: 600;
		}

		.eixo-col {
			width: auto;
		}

		.eixo-col .trilho {
			margin-top: calc(var(--grid) * 0.8);
		}

		.mini {
			display: none;
		}

		.faixas {
			gap: calc(var(--grid) * 1.2);
		}

		.faixa .r {
			font-size: var(--t-label);
		}

		.faixa .p {
			font-size: var(--t-mini);
		}

		.histo {
			gap: 1px;
			height: 72px;
		}
	}
</style>
