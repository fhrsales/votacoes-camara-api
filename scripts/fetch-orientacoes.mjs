// Downloads how each party, bloc and the government leader told their members to vote, for
// every Câmara roll call we already have votes for. This is what makes "governista" and
// "seguiu o partido" measurable on the deputy pages.
//
// One small file per roll call in static/data/orientacoes/, fetched once. Roll calls that the
// API answers with an empty list are stored too, so they are not asked again every day.
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const API_BASE = 'https://dadosabertos.camara.leg.br/api/v2';
const DATA_DIR = path.join(process.cwd(), 'static', 'data');
const VOTOS_DIR = path.join(DATA_DIR, 'votos');
const DIR = path.join(DATA_DIR, 'orientacoes');
const RETRIES = Number(process.env.VOTACOES_RETRIES ?? '4');
const RETRY_DELAY = Number(process.env.VOTACOES_RETRY_DELAY ?? '800');
const TIMEOUT = Number(process.env.VOTACOES_FETCH_TIMEOUT ?? '20000');
const LIMITE = Number(process.env.ORIENTACOES_LIMITE ?? '0'); // 0 = all pending
const PARALELO = Number(process.env.ORIENTACOES_PARALELO ?? '3');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscar(url) {
	let ultimo;
	for (let tentativa = 0; tentativa < RETRIES; tentativa += 1) {
		const controle = new AbortController();
		const timer = setTimeout(() => controle.abort(), TIMEOUT);
		try {
			const res = await fetch(url, { headers: { accept: 'application/json' }, signal: controle.signal });
			if (res.status === 404) return { dados: [] };
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return await res.json();
		} catch (erro) {
			ultimo = erro;
			await sleep(RETRY_DELAY * 2 ** tentativa);
		} finally {
			clearTimeout(timer);
		}
	}
	throw ultimo;
}

// Keeps only what the profiles need: who oriented, and how
function compactar(dados = []) {
	return dados
		.map((o) => ({
			sigla: o.siglaPartidoBloco ?? o.sigla ?? '',
			tipo: o.codTipoLideranca ?? '',
			voto: o.orientacaoVoto ?? o.orientacao ?? ''
		}))
		.filter((o) => o.sigla && o.voto);
}

async function main() {
	await mkdir(DIR, { recursive: true });
	const feitos = new Set((await readdir(DIR).catch(() => [])).map((f) => f.replace('.json', '')));
	const ids = (await readdir(VOTOS_DIR))
		.filter((f) => f.endsWith('.json') && f !== 'index.json')
		.map((f) => f.replace('.json', ''))
		.filter((id) => !feitos.has(id));
	const fila = LIMITE > 0 ? ids.slice(0, LIMITE) : ids;
	console.log(`Orientações pendentes: ${ids.length}; buscando ${fila.length}`);

	let ok = 0;
	let falhas = 0;
	let i = 0;
	async function trabalhador() {
		while (i < fila.length) {
			const id = fila[i++];
			try {
				const json = await buscar(`${API_BASE}/votacoes/${id}/orientacoes`);
				const orientacoes = compactar(json?.dados);
				await writeFile(path.join(DIR, `${id}.json`), JSON.stringify({ id, orientacoes }) + '\n', 'utf8');
				ok += 1;
			} catch (erro) {
				falhas += 1;
				console.warn(`Falha nas orientações de ${id}: ${erro?.message ?? erro}`);
			}
			await sleep(150);
		}
	}
	await Promise.all(Array.from({ length: PARALELO }, trabalhador));
	console.log(`Orientações: ${ok} gravadas, ${falhas} falhas`);
}

main().catch((erro) => {
	console.error(erro);
	process.exit(1);
});
