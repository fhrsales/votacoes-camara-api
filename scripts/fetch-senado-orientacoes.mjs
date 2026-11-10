// Senado: how each party leader and the government leader told their senators to vote.
// The Senado publishes them per period; we match each roll call to ours by its sequential
// number and write static/data/senado/orientacoes/{id}.json in the same shape as the Câmara's.
// By default only the last SENADO_MONTHS months are refreshed; SENADO_ORIENT_DESDE=2023-02 redoes all.
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const API = 'https://legis.senado.leg.br/dadosabertos';
const DIR = path.join(process.cwd(), 'static', 'data', 'senado');
const SAIDA = path.join(DIR, 'orientacoes');
const MESES = Number(process.env.SENADO_MONTHS ?? '2');
const DESDE = process.env.SENADO_ORIENT_DESDE;
const TIMEOUT = Number(process.env.VOTACOES_FETCH_TIMEOUT ?? '60000');
const RETRIES = Number(process.env.VOTACOES_RETRIES ?? '3');

const pad2 = (n) => String(n).padStart(2, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
			await sleep(1000 * (i + 1));
		} finally {
			clearTimeout(timer);
		}
	}
	throw ultimo;
}

const VOTO = { SIM: 'Sim', 'NÃO': 'Não', NAO: 'Não', 'ABSTENÇÃO': 'Abstenção', 'OBSTRUÇÃO': 'Obstrução', LIVRE: 'Liberado' };
const tipo = (sigla) => {
	const s = sigla.toLowerCase();
	if (s === 'governo') return 'G';
	if (s === 'maioria' || s === 'minoria' || s === 'oposição' || s.startsWith('bloco')) return 'B';
	return 'P';
};

function listaDeMeses() {
	const hoje = new Date();
	const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
	let ini = new Date(fim.getFullYear(), fim.getMonth() - (MESES - 1), 1);
	if (DESDE) ini = new Date(`${DESDE}-01T12:00:00`);
	const out = [];
	for (let d = new Date(ini.getFullYear(), ini.getMonth(), 1); d <= fim; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) out.push(d);
	return out;
}

async function main() {
	await mkdir(SAIDA, { recursive: true });
	let gravadas = 0;
	for (const d of listaDeMeses()) {
		const ano = d.getFullYear();
		const mes = d.getMonth() + 1;
		const valor = `${ano}-${pad2(mes)}`;
		const nossas = JSON.parse(await readFile(path.join(DIR, 'votacoes', `${valor}.json`), 'utf8').catch(() => '{}'));
		const porSeq = new Map((nossas.votacoes ?? []).map((v) => [Number(v.sequencial), v.id]));
		if (!porSeq.size) continue;
		const ultimo = new Date(ano, mes, 0).getDate();
		let dados;
		try {
			dados = await buscar(`${API}/plenario/votacao/orientacaoBancada/${ano}${pad2(mes)}01/${ano}${pad2(mes)}${pad2(ultimo)}.json`);
		} catch (erro) {
			console.warn(`Orientações ${valor}: ${erro.message}`);
			continue;
		}
		for (const v of dados?.votacoes ?? []) {
			const id = porSeq.get(Number(v.sequencialVotacao));
			if (!id || !v.orientacoesLideranca?.length) continue;
			const orientacoes = v.orientacoesLideranca
				.filter((o) => o.partido && VOTO[o.voto?.toUpperCase()])
				.map((o) => ({ sigla: o.partido.trim(), tipo: tipo(o.partido.trim()), voto: VOTO[o.voto.toUpperCase()] }));
			if (!orientacoes.length) continue;
			await writeFile(path.join(SAIDA, `${id}.json`), JSON.stringify({ id, orientacoes }) + '\n', 'utf8');
			gravadas += 1;
		}
		await sleep(300);
	}
	console.log(`Senado: orientações de ${gravadas} votações`);
}

main().catch((erro) => {
	console.error(erro);
	process.exit(1);
});
