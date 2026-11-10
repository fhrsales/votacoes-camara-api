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
		{ chave: 'prog', rotulo: 'Progressistas', de: 0, ate: 2, cor: 'var(--vote-sim)' },
		{ chave: 'centro', rotulo: 'Centro', de: 2, ate: 6, cor: 'var(--vote-abstencao)' },
		{ chave: 'cons', rotulo: 'Conservadores', de: 6, ate: 10.01, cor: 'var(--accent-amber-ink)' }
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
		governismo: { rotulo: 'Mais governistas', fn: (a, b) => (b.governismo ?? -1) - (a.governismo ?? -1) },
		oposicao: { rotulo: 'Mais de oposição', fn: (a, b) => (a.governismo ?? 101) - (b.governismo ?? 101) },
		fidelidade: { rotulo: 'Menos fiéis ao partido', fn: (a, b) => (a.fidelidade ?? 101) - (b.fidelidade ?? 101) },
		presenca: { rotulo: 'Menor presença', fn: (a, b) => (a.presenca ?? 101) - (b.presenca ?? 101) },
		progressista: { rotulo: 'Mais progressistas', fn: (a, b) => a.eixo - b.eixo },
		conservador: { rotulo: 'Mais conservadores', fn: (a, b) => b.eixo - a.eixo },
		gasto: { rotulo: 'Maior gasto da cota', fn: (a, b) => (b.gasto ?? -1) - (a.gasto ?? -1) }
	};

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
		<div class="histo" aria-hidden="true">
			{#each histograma as b}
				<span class="col" class:apagada={faixa && faixa !== b.faixa.chave} title={`${num(b.n)} entre ${num(b.de, 2)} e ${num(b.de + 10 / BINS, 2)}`}>
					<i style={`height:${(b.n / maxBin) * 100}%;background:${b.faixa.cor}`} />
				</span>
			{/each}
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
				<th>Nome</th>
				<th class="n">Presença</th>
				{#if !governismoAusente}<th class="n">Governo</th>{/if}
				<th class="n">Partido</th>
				<th class="eixo-col"><span class="eixo-cab"><span>Prog.</span><span>Cons.</span></span></th>
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
					<td class="n">
						<span class="medida"><span class="mini"><i style={`width:${d.presenca ?? 0}%`} /></span>{num(d.presenca)}%</span>
					</td>
					{#if !governismoAusente}
						<td class="n">
							<span class="medida"><span class="mini"><i style={`width:${d.governismo ?? 0}%`} /></span>{d.governismo == null ? '—' : `${num(d.governismo)}%`}</span>
						</td>
					{/if}
					<td class="n">
						<span class="medida"><span class="mini"><i style={`width:${d.fidelidade ?? 0}%`} /></span>{num(d.fidelidade)}%</span>
					</td>
					<td class="eixo-col">
						<span class="trilho" aria-label={`${num(d.eixo, 1)} de 10`}>
							<span class="meio" />
							<i style={`left:${d.eixo * 10}%`} />
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
		grid-template-columns: repeat(3, 1fr);
		gap: calc(var(--grid) * 1);
		margin: calc(var(--grid) * 1.2) 0;
	}

	.faixa {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: calc(var(--grid) * 1.2) calc(var(--grid) * 1.4);
		border: 1px solid var(--color-rule);
		border-top: 4px solid var(--cor);
		border-radius: 12px;
		background: none;
		color: var(--color-dark);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: opacity 160ms var(--ease), background 160ms var(--ease);
	}

	.faixa:hover,
	.faixa.ativa {
		background: color-mix(in srgb, var(--cor) 12%, transparent);
	}

	.faixa .n {
		font-family: var(--font-display);
		font-size: clamp(32px, 6vw, 48px);
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
		height: 10px;
		border-radius: 999px;
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

	.histo .col {
		flex: 1;
		height: 100%;
		display: flex;
		align-items: flex-end;
		transition: opacity 160ms var(--ease);
	}

	.histo i {
		display: block;
		width: 100%;
		min-height: 1px;
		border-radius: 3px 3px 0 0;
	}

	.eixo-rot {
		display: flex;
		justify-content: space-between;
		margin-top: 6px;
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

	.medida {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}

	.mini {
		display: inline-block;
		width: 64px;
		height: 8px;
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
		height: 8px;
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
		.eixo-col {
			width: 64px;
		}

		.mini {
			display: none;
		}

		.nome small {
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}

		.n {
			padding-right: calc(var(--grid) * 1);
		}

		th {
			font-size: 11px;
		}

		.faixas {
			gap: 6px;
		}

		.faixa {
			padding: calc(var(--grid) * 1) calc(var(--grid) * 1);
		}

		.faixa .r {
			font-size: var(--t-small);
		}

		.faixa .p {
			font-size: 11px;
		}

		.histo {
			gap: 1px;
			height: 72px;
		}
	}
</style>
