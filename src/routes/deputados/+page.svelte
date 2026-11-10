<script>
	import { base } from '$app/paths';

	export let data;
	$: indice = data.indice;

	let busca = '';
	let partido = '';
	let ordem = 'nome';

	const ORDENS = {
		nome: { rotulo: 'Nome', fn: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR') },
		governismo: { rotulo: 'Mais governistas', fn: (a, b) => (b.governismo ?? -1) - (a.governismo ?? -1) },
		oposicao: { rotulo: 'Mais de oposição', fn: (a, b) => (a.governismo ?? 101) - (b.governismo ?? 101) },
		fidelidade: { rotulo: 'Menos fiéis ao partido', fn: (a, b) => (a.fidelidade ?? 101) - (b.fidelidade ?? 101) },
		presenca: { rotulo: 'Menor presença', fn: (a, b) => (a.presenca ?? 101) - (b.presenca ?? 101) },
		progressista: { rotulo: 'Mais progressistas', fn: (a, b) => a.eixo - b.eixo },
		conservador: { rotulo: 'Mais conservadores', fn: (a, b) => b.eixo - a.eixo }
	};

	const semAcento = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
	$: partidos = [...new Set(indice.deputados.map((d) => d.partido))].sort();
	$: termo = semAcento(busca.trim());
	$: lista = indice.deputados
		.filter((d) => (!partido || d.partido === partido) && (!termo || semAcento(`${d.nome} ${d.uf}`).includes(termo)))
		.sort(ORDENS[ordem].fn);
	$: governismoAusente = indice.deputados.every((d) => d.governismo == null);

	const num = (v, c = 0) =>
		v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
</script>

<svelte:head>
	<title>Deputados: como cada um vota · Voto a voto</title>
	<meta
		name="description"
		content="Presença, alinhamento com o governo e com o partido, e posição entre progressistas e conservadores de cada deputado e deputada federal."
	/>
</svelte:head>

<main class="pagina">
	<nav class="trilha"><a href={`${base}/`}>← Votações</a></nav>

	<p class="ds-label">Câmara dos Deputados · legislatura {indice.legislatura}</p>
	<h1>Como cada deputado vota</h1>
	<p class="lead">
		{num(indice.deputados.length)} deputados e deputadas, a partir de {num(indice.votacoes)} votações nominais
		desde fevereiro de 2023. Escolha um nome para ver o perfil completo.
	</p>

	<div class="filtros">
		<label class="busca">
			<span class="sr">Buscar por nome ou estado</span>
			<input type="search" bind:value={busca} placeholder="Buscar por nome ou estado" autocomplete="off" />
		</label>
		<label>
			<span class="sr">Partido</span>
			<select bind:value={partido}>
				<option value="">Todos os partidos</option>
				{#each partidos as sigla}<option value={sigla}>{sigla}</option>{/each}
			</select>
		</label>
		<label>
			<span class="sr">Ordenar</span>
			<select bind:value={ordem}>
				{#each Object.entries(ORDENS) as [chave, o]}
					{#if !(governismoAusente && (chave === 'governismo' || chave === 'oposicao'))}
						<option value={chave}>{o.rotulo}</option>
					{/if}
				{/each}
			</select>
		</label>
	</div>

	<table class="tabela">
		<thead>
			<tr>
				<th>Nome</th>
				<th class="n">Presença</th>
				{#if !governismoAusente}<th class="n">Governo</th>{/if}
				<th class="n">Partido</th>
				<th class="eixo-col">Prog. → cons.</th>
			</tr>
		</thead>
		<tbody>
			{#each lista as d (d.id)}
				<tr>
					<td>
						<a href={`${base}/deputado/${d.slug}`}>
							<span class="foto"><img src={d.foto} alt="" width="36" height="36" loading="lazy" /></span>
							<span class="nome">
								<b>{d.nome}</b>
								<small>{d.partido} · {d.uf}</small>
							</span>
						</a>
					</td>
					<td class="n">{num(d.presenca)}%</td>
					{#if !governismoAusente}<td class="n">{d.governismo == null ? '—' : `${num(d.governismo)}%`}</td>{/if}
					<td class="n">{num(d.fidelidade)}%</td>
					<td class="eixo-col">
						<span class="trilho" aria-label={`${num(d.eixo, 1)} de 10`}><i style={`left:${d.eixo * 10}%`} /></span>
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

	input,
	select {
		width: 100%;
		font: inherit;
		font-size: 16px;
		padding: 8px 14px;
		border: 1px solid var(--color-dark);
		border-radius: 999px;
		background: var(--color-light);
		color: var(--color-dark);
	}

	select {
		width: auto;
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
		flex: 0 0 auto;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--vote-ausentes);
	}

	.foto img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.nome {
		display: flex;
		flex-direction: column;
	}

	.nome small {
		color: var(--color-text-muted);
	}

	.eixo-col {
		width: 140px;
	}

	.trilho {
		position: relative;
		display: block;
		height: 6px;
		border-radius: 999px;
		background: var(--vote-ausentes);
	}

	.trilho i {
		position: absolute;
		top: 50%;
		width: 12px;
		height: 12px;
		margin: -6px 0 0 -6px;
		border-radius: 50%;
		background: var(--accent-amber);
		border: 2px solid var(--color-light);
	}

	.vazio {
		color: var(--color-text-muted);
	}

	@media (max-width: 600px) {
		.eixo-col {
			width: 72px;
		}

		.n {
			padding-right: calc(var(--grid) * 1);
		}

		th {
			font-size: 11px;
		}
	}
</style>
