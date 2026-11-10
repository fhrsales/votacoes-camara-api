// Builds one profile per deputy of the current legislature from the roll calls we keep:
// how often they voted, how often with the government leader, how often with their own party,
// where their votes place them between the two ends of the chamber, and the votes in which
// they broke with their party.
//
// Reads static/data/votos, static/data/votacoes and static/data/orientacoes; writes
// static/data/perfis/index.json and one static/data/perfis/{id}.json per deputy.
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'static', 'data');
const SAIDA = path.join(DATA_DIR, 'perfis');
const MIN_VOTOS = 20; // fewer than this and the percentages say nothing
const MAX_DIVERGENCIAS = 40;

const lerJson = async (arquivo) => JSON.parse(await readFile(arquivo, 'utf8'));

function semAcento(s = '') {
	return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function slugDeputado(nome, id) {
	const base = semAcento(nome)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return `${base}-${id}`;
}

// Yes, no, or nothing: obstruction is a way of voting against, abstention is neither
function lado(voto) {
	if (voto === 'Sim') return 1;
	if (voto === 'Não' || voto === 'Obstrução') return -1;
	return 0;
}

// Orientations come per party, per federation ("Fdr PT-PCdoB-PV") or per bloc
// ("Bl MdbPsdRepPode"). Split the name into party tokens to find the one that covers a party.
function tokens(sigla) {
	return semAcento(sigla)
		.replace(/^(bl|fdr|bloco|federacao)\b\.?\s*/i, '')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.split(/[^A-Za-z0-9]+/)
		.map((t) => t.toLowerCase())
		.filter(Boolean);
}

function orientacaoDoPartido(orientacoes, partido) {
	if (!partido) return null;
	const p = semAcento(partido).toLowerCase();
	const exata = orientacoes.find((o) => semAcento(o.sigla).toLowerCase() === p);
	if (exata) return exata;
	return (
		orientacoes.find((o) =>
			tokens(o.sigla).some((t) => t === p || (t.length >= 3 && p.startsWith(t)))
		) ?? null
	);
}

function orientacaoDoGoverno(orientacoes) {
	return (
		orientacoes.find((o) => {
			const s = semAcento(o.sigla).toLowerCase().replace(/\.$/, '');
			return s === 'gov' || s === 'governo' || o.tipo === 'G';
		}) ?? null
	);
}

// One-dimensional position from the votes alone (alternating least squares with missing votes):
// vote_ij ≈ a_j * x_i + b_j. Close to what W-NOMINATE's first dimension gives for a chamber
// this polarised, and needs no labelling of votes by hand.
function eixo(matriz, nDep, nVot, iteracoes = 60) {
	const x = new Float64Array(nDep).map((_, i) => Math.sin(i * 12.9898) * 0.5);
	const a = new Float64Array(nVot).fill(1);
	const b = new Float64Array(nVot);
	const porDep = Array.from({ length: nDep }, () => []);
	const porVot = Array.from({ length: nVot }, () => []);
	for (const [i, j, v] of matriz) {
		porDep[i].push([j, v]);
		porVot[j].push([i, v]);
	}
	for (let it = 0; it < iteracoes; it += 1) {
		for (let j = 0; j < nVot; j += 1) {
			let sx = 0, sy = 0, sxx = 0, sxy = 0;
			const n = porVot[j].length;
			for (const [i, v] of porVot[j]) {
				sx += x[i];
				sy += v;
				sxx += x[i] * x[i];
				sxy += x[i] * v;
			}
			const den = n * sxx - sx * sx;
			a[j] = den > 1e-9 ? (n * sxy - sx * sy) / den : 0;
			b[j] = (sy - a[j] * sx) / n;
		}
		for (let i = 0; i < nDep; i += 1) {
			let num = 0, den = 0;
			for (const [j, v] of porDep[i]) {
				num += a[j] * (v - b[j]);
				den += a[j] * a[j];
			}
			x[i] = den > 1e-9 ? num / den : 0;
		}
		let m = 0;
		for (let i = 0; i < nDep; i += 1) m += x[i];
		m /= nDep;
		let s = 0;
		for (let i = 0; i < nDep; i += 1) s += (x[i] - m) ** 2;
		s = Math.sqrt(s / nDep) || 1;
		for (let i = 0; i < nDep; i += 1) x[i] = (x[i] - m) / s;
	}
	return x;
}

const pct = (a, n) => (n ? Math.round((a / n) * 1000) / 10 : null);
// A share over a handful of votes says little: below these bases the measure is left out
const BASE_MIN = 20;
const BASE_MIN_ANO = 8;
const pctMin = (a, n, min) => (n >= min ? pct(a, n) : null);

async function main() {
	const legIndex = await lerJson(path.join(DATA_DIR, 'deputados', 'legislaturas', 'index.json'));
	const leg = legIndex.legislaturas.reduce((m, l) => (Number(l.id) > Number(m.id) ? l : m));
	const inicioLeg = leg.dataInicio;
	const contatos = await lerJson(path.join(DATA_DIR, 'deputados', 'emails.json')).catch(() => ({}));
	const mulheres = new Set((contatos.mulheres ?? []).map(Number));

	// Every roll call of the legislature, with its date and description
	const meses = (await readdir(path.join(DATA_DIR, 'votacoes'))).filter((f) => /^\d{4}-\d{2}\.json$/.test(f));
	const info = new Map();
	for (const m of meses) {
		const d = await lerJson(path.join(DATA_DIR, 'votacoes', m));
		for (const v of d.votacoes ?? []) {
			if ((v.data ?? '') >= inicioLeg) info.set(String(v.id), v);
		}
	}

	const arquivos = new Set(await readdir(path.join(DATA_DIR, 'votos')));
	const orientArquivos = new Set(await readdir(path.join(DATA_DIR, 'orientacoes')).catch(() => []));
	const votacoes = [...info.values()]
		.filter((v) => arquivos.has(`${v.id}.json`))
		.sort((p, q) => (p.dataHoraRegistro ?? '').localeCompare(q.dataHoraRegistro ?? ''));

	const deps = new Map(); // id -> accumulators
	const colunas = []; // contested roll calls used for the axis
	const celulas = []; // [depId, coluna, lado]
	let comOrientacao = 0;

	for (const v of votacoes) {
		const { votos = [], resumoTexto = '' } = await lerJson(path.join(DATA_DIR, 'votos', `${v.id}.json`));
		const ementa = resumoTexto.length > 260 ? `${resumoTexto.slice(0, 257).trimEnd()}…` : resumoTexto;
		const orientacoes = orientArquivos.has(`${v.id}.json`)
			? (await lerJson(path.join(DATA_DIR, 'orientacoes', `${v.id}.json`))).orientacoes ?? []
			: [];
		if (orientacoes.length) comOrientacao += 1;
		const gov = orientacaoDoGoverno(orientacoes);
		const ladoGov = gov ? lado(gov.voto) : 0;

		// party majority, used when the party gave no orientation
		const maioria = new Map();
		for (const voto of votos) {
			const p = voto.deputado_?.siglaPartido;
			const l = lado(voto.tipoVoto);
			if (!p || !l) continue;
			maioria.set(p, (maioria.get(p) ?? 0) + l);
		}

		let sim = 0, nao = 0;
		for (const voto of votos) {
			const l = lado(voto.tipoVoto);
			if (l > 0) sim += 1;
			if (l < 0) nao += 1;
		}
		const disputada = Math.min(sim, nao) >= Math.max(5, 0.025 * (sim + nao));
		const coluna = disputada ? colunas.push(v.id) - 1 : -1;
		const ano = (v.data ?? '').slice(0, 4);

		for (const voto of votos) {
			const d = voto.deputado_;
			if (!d?.id || Number(d.idLegislatura) !== Number(leg.id)) continue;
			let a = deps.get(d.id);
			if (!a) {
				a = {
					id: d.id,
					nome: d.nome,
					partido: d.siglaPartido,
					uf: d.siglaUf,
					foto: d.urlFoto,
					primeira: v.dataHoraRegistro,
					ultima: v.dataHoraRegistro,
					votos: 0,
					contagem: { Sim: 0, Não: 0, Abstenção: 0, Obstrução: 0 },
					gov: { a: 0, n: 0 },
					partidoOk: { a: 0, n: 0, porOrientacao: 0 },
					anos: {},
					partidos: [],
					divergencias: []
				};
				deps.set(d.id, a);
			}
			a.nome = d.nome;
			a.foto = d.urlFoto || a.foto;
			a.uf = d.siglaUf || a.uf;
			if (d.siglaPartido && a.partido !== d.siglaPartido) a.partido = d.siglaPartido;
			const ultimoPartido = a.partidos[a.partidos.length - 1];
			if (d.siglaPartido && ultimoPartido?.sigla !== d.siglaPartido) {
				a.partidos.push({ sigla: d.siglaPartido, desde: v.data });
			}
			a.ultima = v.dataHoraRegistro;
			a.votos += 1;
			if (a.contagem[voto.tipoVoto] != null) a.contagem[voto.tipoVoto] += 1;
			const anoAcc = (a.anos[ano] ??= { gov: { a: 0, n: 0 }, partido: { a: 0, n: 0 }, votos: 0 });
			anoAcc.votos += 1;

			const l = lado(voto.tipoVoto);
			if (coluna >= 0 && l) celulas.push([d.id, coluna, l]);

			if (ladoGov) {
				a.gov.n += 1;
				anoAcc.gov.n += 1;
				if (l === ladoGov) {
					a.gov.a += 1;
					anoAcc.gov.a += 1;
				}
			}

			const op = orientacaoDoPartido(orientacoes, d.siglaPartido);
			let ladoPartido = op ? lado(op.voto) : 0;
			const porOrientacao = Boolean(ladoPartido);
			if (!ladoPartido && !op) {
				const s = maioria.get(d.siglaPartido) ?? 0;
				ladoPartido = s > 0 ? 1 : s < 0 ? -1 : 0;
			}
			if (ladoPartido) {
				a.partidoOk.n += 1;
				anoAcc.partido.n += 1;
				if (porOrientacao) a.partidoOk.porOrientacao += 1;
				if (l === ladoPartido) {
					a.partidoOk.a += 1;
					anoAcc.partido.a += 1;
				} else if (l) {
					a.divergencias.push({
						id: v.id,
						data: v.dataHoraRegistro,
						descricao: v.descricao,
						ementa,
						voto: voto.tipoVoto,
						partido: ladoPartido > 0 ? 'Sim' : 'Não',
						porOrientacao,
						governo: ladoGov ? (ladoGov > 0 ? 'Sim' : 'Não') : null
					});
				}
			}
		}
	}

	// Presence: votes cast out of the roll calls held between their first and last vote
	const datas = votacoes.map((v) => v.dataHoraRegistro);
	const contarEntre = (de, ate) => {
		let n = 0;
		for (const d of datas) if (d >= de && d <= ate) n += 1;
		return n;
	};

	const lista = [...deps.values()].filter((a) => a.votos >= MIN_VOTOS);
	const indice = new Map(lista.map((a, i) => [a.id, i]));
	const matriz = celulas.filter(([id]) => indice.has(id)).map(([id, j, l]) => [indice.get(id), j, l]);
	const x = eixo(matriz, lista.length, colunas.length);

	// Orient the axis: the PSOL end is the progressive (left) side, PL the conservative (right)
	const media = (p) => {
		const xs = lista.map((a, i) => (a.partido === p ? x[i] : null)).filter((v) => v != null);
		return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
	};
	if (media('PSOL') > media('PL')) for (let i = 0; i < x.length; i += 1) x[i] = -x[i];
	const xs = [...x].sort((p, q) => p - q);
	const lo = xs[Math.floor(xs.length * 0.01)];
	const hi = xs[Math.ceil(xs.length * 0.99) - 1];
	// 0 = most progressive, 10 = most conservative, clipped at the 1st/99th percentile
	const escala = (v) => Math.round(Math.min(10, Math.max(0, ((v - lo) / (hi - lo)) * 10)) * 10) / 10;

	await rm(SAIDA, { recursive: true, force: true });
	await mkdir(SAIDA, { recursive: true });

	const resumo = [];
	for (const [i, a] of lista.entries()) {
		const slug = slugDeputado(a.nome, a.id);
		const realizadas = contarEntre(a.primeira, a.ultima);
		const perfil = {
			id: a.id,
			slug,
			nome: a.nome,
			mulher: mulheres.has(Number(a.id)),
			partido: a.partido,
			partidos: a.partidos,
			uf: a.uf,
			foto: a.foto,
			votos: a.votos,
			periodo: { de: a.primeira, ate: a.ultima, votacoes: realizadas },
			presenca: pct(a.votos, realizadas),
			contagem: a.contagem,
			governismo: pctMin(a.gov.a, a.gov.n, BASE_MIN),
			governismoBase: a.gov.n,
			fidelidade: pctMin(a.partidoOk.a, a.partidoOk.n, BASE_MIN),
			fidelidadeBase: a.partidoOk.n,
			fidelidadePorOrientacao: a.partidoOk.porOrientacao,
			eixo: escala(x[i]),
			anos: Object.fromEntries(
				Object.entries(a.anos)
					.sort()
					.map(([ano, v]) => [
						ano,
						{
							votos: v.votos,
							governismo: pctMin(v.gov.a, v.gov.n, BASE_MIN_ANO),
							fidelidade: pctMin(v.partido.a, v.partido.n, BASE_MIN_ANO)
						}
					])
			),
			divergencias: a.divergencias.slice(-MAX_DIVERGENCIAS).reverse(),
			totalDivergencias: a.divergencias.length
		};
		await writeFile(path.join(SAIDA, `${a.id}.json`), JSON.stringify(perfil) + '\n', 'utf8');
		resumo.push({
			id: a.id,
			slug,
			nome: a.nome,
			mulher: perfil.mulher,
			partido: a.partido,
			uf: a.uf,
			foto: a.foto,
			votos: a.votos,
			presenca: perfil.presenca,
			governismo: perfil.governismo,
			fidelidade: perfil.fidelidade,
			eixo: perfil.eixo
		});
	}
	resumo.sort((p, q) => p.nome.localeCompare(q.nome, 'pt-BR'));

	await writeFile(
		path.join(SAIDA, 'index.json'),
		JSON.stringify({
			generatedAt: new Date().toISOString(),
			legislatura: leg.id,
			desde: inicioLeg,
			votacoes: votacoes.length,
			votacoesNoEixo: colunas.length,
			votacoesComOrientacao: comOrientacao,
			deputados: resumo
		}) + '\n',
		'utf8'
	);
	console.log(
		`Perfis: ${resumo.length} deputados, ${votacoes.length} votações (${colunas.length} disputadas no eixo, ${comOrientacao} com orientação)`
	);
}

main().catch((erro) => {
	console.error(erro);
	process.exit(1);
});
