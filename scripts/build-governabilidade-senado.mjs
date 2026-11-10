// Governability in the Senado: how often the Senate plenary followed the government leader's
// orientation. The Senado publishes the leaders' orientations with every senator's vote only from
// February 2019 (endpoint plenario/votacao/orientacaoBancada; earlier months come back empty), so
// the series covers Bolsonaro and Lula 3. Same output shape as build-governabilidade.mjs (Câmara),
// written to static/data/senado/governabilidade. Each year is summarised once into anos/{ano}.json;
// only the years in GOV_ANOS are downloaded again (default: this year and last).
// GOV_ANOS=2019-2026 rebuilds everything.
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const API = 'https://legis.senado.leg.br/dadosabertos';
const SAIDA = path.join(process.cwd(), 'static', 'data', 'senado', 'governabilidade');
const ANOS_DIR = path.join(SAIDA, 'anos');
const INICIO = '2019-02'; // first month with orientations in the API
const MIN_VOTOS = 20; // a senator needs this many votes in a government to count in its base
const MIN_VOTOS_PARTIDO = 100; // a party needs this many votes to appear in the party chart
const TIMEOUT = Number(process.env.VOTACOES_FETCH_TIMEOUT ?? '90000');
const RETRIES = Number(process.env.VOTACOES_RETRIES ?? '3');

const GOVERNOS = [
	{ chave: 'bolsonaro', nome: 'Bolsonaro', presidente: 'Jair Bolsonaro', de: '2019-01-01', ate: '2022-12-31' },
	{ chave: 'lula3', nome: 'Lula 3', presidente: 'Luiz Inácio Lula da Silva', de: '2023-01-01', ate: '2026-12-31' }
];
const governoDe = (data) => GOVERNOS.find((g) => data >= g.de && data <= g.ate)?.chave;

const pad2 = (n) => String(n).padStart(2, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function anosPedidos() {
	const atual = new Date().getFullYear();
	const txt = process.env.GOV_ANOS;
	if (!txt) return [atual - 1, atual];
	const [a, b] = txt.split('-').map(Number);
	const out = [];
	for (let y = Math.max(a, 2019); y <= (b || a); y += 1) out.push(y);
	return out;
}

async function buscar(url) {
	let ultimo;
	for (let i = 0; i <= RETRIES; i += 1) {
		const controle = new AbortController();
		const timer = setTimeout(() => controle.abort(), TIMEOUT);
		try {
			const res = await fetch(url, { headers: { accept: 'application/json' }, signal: controle.signal });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return await res.json();
		} catch (erro) {
			ultimo = erro;
			await sleep(1500 * (i + 1));
		} finally {
			clearTimeout(timer);
		}
	}
	throw ultimo;
}

// Government orientation and votes: Sim, or Não (obstruction counts as Não); free votes are left out
const direcao = (v) => (v === 'SIM' ? 'Sim' : v === 'NÃO' || v === 'OBSTRUÇÃO' ? 'Não' : null);
const VOTOS = new Set(['SIM', 'NÃO', 'ABSTENÇÃO', 'OBSTRUÇÃO']);

// Whether the matter passed, from the tally: constitutional amendments need 49 of 81, complementary
// laws 41, the rest a simple majority. Vetoes (decided with the Câmara) and ties are left out
function aprovada(v) {
	const sim = v.qtdVotosSim ?? 0;
	const nao = v.qtdVotosNao ?? 0;
	const tipo = v.siglaTipoMateria ?? '';
	if (/^VET/.test(tipo)) return null;
	if (tipo === 'PEC') return sim >= 49;
	if (tipo === 'PLP') return sim >= 41;
	if (sim === nao) return null;
	return sim > nao;
}

async function resumirAno(ano) {
	const governos = {};
	const meses = {};
	const hoje = new Date().toISOString().slice(0, 7);
	for (let mes = 1; mes <= 12; mes += 1) {
		const chave = `${ano}-${pad2(mes)}`;
		if (chave < INICIO || chave > hoje) continue;
		const ultimo = new Date(ano, mes, 0).getDate();
		const dados = await buscar(`${API}/plenario/votacao/orientacaoBancada/${ano}${pad2(mes)}01/${ano}${pad2(mes)}${pad2(ultimo)}.json`);
		for (const v of dados?.votacoes ?? []) {
			// Senate plenary only: joint sessions of Congress (vetoes) and secret ballots are left out
			if (/\bCN\b|Congresso/i.test(v.descricaoSessao ?? '')) continue;
			const gov = (v.orientacoesLideranca ?? []).find((o) => /^governo$/i.test((o.partido ?? '').trim()));
			const dir = direcao(gov?.voto);
			if (!dir) continue;
			const data = (v.dataInicioVotacao ?? '').slice(0, 10);
			const g = governoDe(data);
			if (!g) continue;
			let segue = 0;
			let n = 0;
			const G = (governos[g] ??= { votacoes: 0, comResultado: 0, vitorias: 0, segue: 0, n: 0, partidos: {}, deputados: {} });
			for (const p of v.votosParlamentar ?? []) {
				if (!VOTOS.has(p.voto)) continue;
				const s = dir === 'Sim' ? p.voto === 'SIM' : p.voto === 'NÃO' || p.voto === 'OBSTRUÇÃO';
				segue += s;
				n += 1;
				const sigla = p.partido || 'S.PART.';
				const P = (G.partidos[sigla] ??= [0, 0]);
				P[0] += s;
				P[1] += 1;
				// The API gives no senator code here: name and state identify each one
				const id = `${p.nomeParlamentar}|${p.uf}`;
				const D = (G.deputados[id] ??= [0, 0, p.nomeParlamentar, sigla, p.uf]);
				D[0] += s;
				D[1] += 1;
				D[3] = sigla;
			}
			if (!n) continue;
			G.segue += segue;
			G.n += n;
			G.votacoes += 1;
			const ap = aprovada(v);
			const r = ap == null ? null : (dir === 'Sim') === ap;
			if (r != null) {
				G.comResultado += 1;
				G.vitorias += r;
			}
			const m = (meses[data.slice(0, 7)] ??= [0, 0, 0, 0, 0]); // segue, votos, votações, vitórias, com resultado
			m[0] += segue;
			m[1] += n;
			m[2] += 1;
			if (r != null) {
				m[3] += r;
				m[4] += 1;
			}
		}
	}
	return { ano, geradoEm: new Date().toISOString(), meses, governos };
}

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

async function main() {
	await mkdir(ANOS_DIR, { recursive: true });
	for (const ano of anosPedidos()) {
		try {
			const r = await resumirAno(ano);
			await writeFile(path.join(ANOS_DIR, `${ano}.json`), JSON.stringify(r) + '\n', 'utf8');
			const nv = Object.values(r.governos).reduce((s, g) => s + g.votacoes, 0);
			console.log(`Governabilidade Senado ${ano}: ${nv} votações com orientação do governo`);
		} catch (erro) {
			console.warn(`Governabilidade Senado ${ano}: ${erro.message}`);
		}
	}

	const juntos = {};
	const meses = {};
	for (const f of (await readdir(ANOS_DIR)).filter((f) => /^\d{4}\.json$/.test(f)).sort()) {
		const r = JSON.parse(await readFile(path.join(ANOS_DIR, f), 'utf8'));
		Object.assign(meses, r.meses);
		for (const [g, G] of Object.entries(r.governos)) {
			const J = (juntos[g] ??= { votacoes: 0, comResultado: 0, vitorias: 0, segue: 0, n: 0, partidos: {}, deputados: {} });
			for (const k of ['votacoes', 'comResultado', 'vitorias', 'segue', 'n']) J[k] += G[k];
			for (const [s, [a, b]] of Object.entries(G.partidos)) {
				const P = (J.partidos[s] ??= [0, 0]);
				P[0] += a;
				P[1] += b;
			}
			for (const [id, [a, b, nome, sigla, uf]] of Object.entries(G.deputados)) {
				const D = (J.deputados[id] ??= [0, 0, nome, sigla, uf]);
				D[0] += a;
				D[1] += b;
				D[3] = sigla;
			}
		}
	}

	const governos = GOVERNOS.filter((g) => juntos[g.chave]).map((g) => {
		const J = juntos[g.chave];
		const pessoas = Object.values(J.deputados).filter(([, n]) => n >= MIN_VOTOS);
		const taxas = pessoas.map(([s, n]) => s / n);
		const faixas = Array(10).fill(0);
		for (const t of taxas) faixas[Math.min(9, Math.floor(t * 10))] += 1;
		const partidos = Object.entries(J.partidos)
			.filter(([, [, n]]) => n >= MIN_VOTOS_PARTIDO)
			.map(([sigla, [s, n]]) => ({ sigla, adesao: pct(s, n), votos: n }))
			.sort((a, b) => b.votos - a.votos)
			.slice(0, 12)
			.sort((a, b) => b.adesao - a.adesao);
		const fim = g.ate > new Date().toISOString().slice(0, 10) ? null : g.ate;
		return {
			...g,
			// The series starts with the first month the Senado published orientations
			de: g.chave === 'bolsonaro' ? `${INICIO}-01` : g.de,
			ate: fim,
			votacoes: J.votacoes,
			taxaVitoria: pct(J.vitorias, J.comResultado),
			adesao: pct(J.segue, J.n),
			deputados: pessoas.length,
			base: pct(taxas.filter((t) => t >= 0.8).length, pessoas.length),
			oposicao: pct(taxas.filter((t) => t < 0.4).length, pessoas.length),
			faixas,
			partidos
		};
	});

	const serie = Object.entries(meses)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([m, [s, n, v, vit, cr]]) => [m, pct(s, n), v, pct(vit, cr)]);
	await writeFile(
		path.join(SAIDA, 'index.json'),
		JSON.stringify({ geradoEm: new Date().toISOString(), minVotos: MIN_VOTOS, governos, meses: serie }) + '\n',
		'utf8'
	);
	console.log(`Governabilidade Senado: ${governos.map((g) => `${g.nome} ${g.adesao}% (${g.votacoes})`).join(' · ')}`);
}

main().catch((erro) => {
	console.error(erro);
	process.exit(1);
});
