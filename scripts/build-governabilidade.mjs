// Governability per government: how often the Câmara plenary followed the government leader's
// orientation, from Lula's first term to now. Uses the Câmara's yearly bulk files (roll calls,
// orientations and individual votes). Each year is summarised once into
// static/data/governabilidade/anos/{ano}.json; only the years in GOV_ANOS are downloaded again
// (default: this year and last), then every year is combined into index.json.
// GOV_ANOS=2003-2026 rebuilds everything.
import { mkdir, readdir, readFile, writeFile, stat } from 'fs/promises';
import os from 'os';
import path from 'path';

const SAIDA = path.join(process.cwd(), 'static', 'data', 'governabilidade');
const ANOS_DIR = path.join(SAIDA, 'anos');
const CACHE = process.env.GOV_CACHE ?? path.join(os.tmpdir(), 'gov-camara');
const ARQ = 'https://dadosabertos.camara.leg.br/arquivos';
const MIN_VOTOS = 20; // a deputy needs this many votes in a government to count in its base

// Terms by date of inauguration; Dilma's second term ends when she was removed from office
export const GOVERNOS = [
	{ chave: 'lula1', nome: 'Lula 1', presidente: 'Luiz Inácio Lula da Silva', de: '2003-01-01', ate: '2006-12-31' },
	{ chave: 'lula2', nome: 'Lula 2', presidente: 'Luiz Inácio Lula da Silva', de: '2007-01-01', ate: '2010-12-31' },
	{ chave: 'dilma1', nome: 'Dilma 1', presidente: 'Dilma Rousseff', de: '2011-01-01', ate: '2014-12-31' },
	{ chave: 'dilma2', nome: 'Dilma 2', presidente: 'Dilma Rousseff', de: '2015-01-01', ate: '2016-05-11' },
	{ chave: 'temer', nome: 'Temer', presidente: 'Michel Temer', de: '2016-05-12', ate: '2018-12-31' },
	{ chave: 'bolsonaro', nome: 'Bolsonaro', presidente: 'Jair Bolsonaro', de: '2019-01-01', ate: '2022-12-31' },
	{ chave: 'lula3', nome: 'Lula 3', presidente: 'Luiz Inácio Lula da Silva', de: '2023-01-01', ate: '2026-12-31' }
];
const governoDe = (data) => GOVERNOS.find((g) => data >= g.de && data <= g.ate)?.chave;

function anosPedidos() {
	const atual = new Date().getFullYear();
	const txt = process.env.GOV_ANOS;
	if (!txt) return [atual - 1, atual];
	const [a, b] = txt.split('-').map(Number);
	const out = [];
	for (let y = a; y <= (b || a); y += 1) out.push(y);
	return out;
}

// Whole-file CSV parser (';', quotes, quoted line breaks); yields objects keyed by the header
function* linhas(texto) {
	let campos = [];
	let atual = '';
	let aspas = false;
	let cab = null;
	const n = texto.length;
	for (let i = texto.charCodeAt(0) === 0xfeff ? 1 : 0; i <= n; i += 1) {
		const c = i < n ? texto[i] : '\n';
		if (aspas) {
			if (c === '"') {
				if (texto[i + 1] === '"') {
					atual += '"';
					i += 1;
				} else aspas = false;
			} else atual += c;
		} else if (c === '"') aspas = true;
		else if (c === ';') {
			campos.push(atual);
			atual = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && texto[i + 1] === '\n') i += 1;
			campos.push(atual);
			atual = '';
			if (campos.length > 1 || campos[0]) {
				if (!cab) cab = campos;
				else yield Object.fromEntries(cab.map((k, j) => [k, campos[j] ?? '']));
			}
			campos = [];
		} else atual += c;
	}
}

async function baixar(tipo, ano) {
	await mkdir(CACHE, { recursive: true });
	const arq = path.join(CACHE, `${tipo}-${ano}.csv`);
	const atual = ano >= new Date().getFullYear() - 0;
	const existe = await stat(arq).catch(() => null);
	if (!existe || (atual && Date.now() - existe.mtimeMs > 6 * 3600e3)) {
		const res = await fetch(`${ARQ}/${tipo}/csv/${tipo}-${ano}.csv`);
		if (!res.ok) throw new Error(`${tipo} ${ano}: HTTP ${res.status}`);
		await writeFile(arq, Buffer.from(await res.arrayBuffer()));
	}
	return readFile(arq, 'utf8');
}

const venceu = (dir, v) => {
	let aprovada = v.aprovacao === '1' ? true : v.aprovacao === '0' ? false : null;
	if (aprovada == null) {
		if (/^\s*aprovad/i.test(v.descricao)) aprovada = true;
		else if (/^\s*rejeitad/i.test(v.descricao)) aprovada = false;
	}
	return aprovada == null ? null : (dir === 'Sim') === aprovada;
};

async function resumirAno(ano) {
	// Plenary roll calls of the year
	const votacoes = new Map();
	for (const v of linhas(await baixar('votacoes', ano))) {
		if (v.siglaOrgao !== 'PLEN') continue;
		votacoes.set(v.id, { data: v.data, aprovacao: v.aprovacao, descricao: v.descricao });
	}
	// The government leader's orientation: Sim, or Não (obstruction counts as Não); free votes are left out
	const dirGov = new Map();
	for (const o of linhas(await baixar('votacoesOrientacoes', ano))) {
		if (!votacoes.has(o.idVotacao) || dirGov.has(o.idVotacao)) continue;
		const b = o.siglaBancada.trim().toLowerCase();
		if (b !== 'gov.' && b !== 'governo') continue;
		const dir = o.orientacao === 'Sim' ? 'Sim' : o.orientacao === 'Não' || o.orientacao === 'Obstrução' ? 'Não' : null;
		if (dir) dirGov.set(o.idVotacao, dir);
	}

	const governos = {};
	const meses = {};
	const contadas = new Map(); // idVotacao → {segue, n}
	for (const v of linhas(await baixar('votacoesVotos', ano))) {
		const dir = dirGov.get(v.idVotacao);
		if (!dir) continue;
		const voto = v.voto;
		if (voto !== 'Sim' && voto !== 'Não' && voto !== 'Obstrução' && voto !== 'Abstenção') continue;
		const info = votacoes.get(v.idVotacao);
		const g = governoDe(info.data);
		if (!g) continue;
		const segue = dir === 'Sim' ? voto === 'Sim' : voto === 'Não' || voto === 'Obstrução';
		const G = (governos[g] ??= { votacoes: 0, comResultado: 0, vitorias: 0, segue: 0, n: 0, partidos: {}, deputados: {} });
		G.segue += segue;
		G.n += 1;
		const sigla = v.deputado_siglaPartido || 'S.PART.';
		const P = (G.partidos[sigla] ??= [0, 0]);
		P[0] += segue;
		P[1] += 1;
		const D = (G.deputados[v.deputado_id] ??= [0, 0, v.deputado_nome, sigla, v.deputado_siglaUf]);
		D[0] += segue;
		D[1] += 1;
		D[3] = sigla;
		const c = contadas.get(v.idVotacao) ?? { segue: 0, n: 0 };
		c.segue += segue;
		c.n += 1;
		contadas.set(v.idVotacao, c);
	}
	for (const [id, c] of contadas) {
		const info = votacoes.get(id);
		const g = governoDe(info.data);
		const G = governos[g];
		G.votacoes += 1;
		const r = venceu(dirGov.get(id), info);
		if (r != null) {
			G.comResultado += 1;
			G.vitorias += r;
		}
		const m = (meses[info.data.slice(0, 7)] ??= [0, 0, 0, 0, 0]); // segue, votos, votações, vitórias, com resultado
		m[0] += c.segue;
		m[1] += c.n;
		m[2] += 1;
		if (r != null) {
			m[3] += r;
			m[4] += 1;
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
			console.log(`Governabilidade ${ano}: ${nv} votações com orientação do governo`);
		} catch (erro) {
			console.warn(`Governabilidade ${ano}: ${erro.message}`);
		}
	}

	// Combine every summarised year
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
		const deps = Object.values(J.deputados).filter(([, n]) => n >= MIN_VOTOS);
		const taxas = deps.map(([s, n]) => s / n);
		// Distribution of how often each deputy followed the government, in tenths
		const faixas = Array(10).fill(0);
		for (const t of taxas) faixas[Math.min(9, Math.floor(t * 10))] += 1;
		const partidos = Object.entries(J.partidos)
			.filter(([, [, n]]) => n >= 200)
			.map(([sigla, [s, n]]) => ({ sigla, adesao: pct(s, n), votos: n }))
			.sort((a, b) => b.votos - a.votos)
			.slice(0, 12)
			.sort((a, b) => b.adesao - a.adesao);
		const fim = g.ate > new Date().toISOString().slice(0, 10) ? null : g.ate;
		return {
			...g,
			ate: fim,
			votacoes: J.votacoes,
			taxaVitoria: pct(J.vitorias, J.comResultado),
			adesao: pct(J.segue, J.n),
			deputados: deps.length,
			base: pct(taxas.filter((t) => t >= 0.8).length, deps.length),
			oposicao: pct(taxas.filter((t) => t < 0.4).length, deps.length),
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
	console.log(`Governabilidade: ${governos.map((g) => `${g.nome} ${g.adesao}% (${g.votacoes})`).join(' · ')}`);
}

main().catch((erro) => {
	console.error(erro);
	process.exit(1);
});
