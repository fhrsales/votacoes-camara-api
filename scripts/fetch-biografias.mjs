// Who each deputy is: civil name, birth, education, professions, previous occupations and
// mandates outside the Câmara. One file per deputy in static/data/deputados/bio/, fetched once
// and refreshed after BIO_DIAS days. The CPF the API returns is personal data and is not kept.
import { mkdir, readFile, readdir, stat, writeFile } from 'fs/promises';
import path from 'path';

const API_BASE = 'https://dadosabertos.camara.leg.br/api/v2';
const DATA_DIR = path.join(process.cwd(), 'static', 'data');
const DIR = path.join(DATA_DIR, 'deputados', 'bio');
const RETRIES = Number(process.env.VOTACOES_RETRIES ?? '4');
const RETRY_DELAY = Number(process.env.VOTACOES_RETRY_DELAY ?? '800');
const TIMEOUT = Number(process.env.VOTACOES_FETCH_TIMEOUT ?? '20000');
const LIMITE = Number(process.env.BIO_LIMITE ?? '0');
const PARALELO = Number(process.env.BIO_PARALELO ?? '3');
const DIAS = Number(process.env.BIO_DIAS ?? '30');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscar(url) {
	let ultimo;
	for (let tentativa = 0; tentativa < RETRIES; tentativa += 1) {
		const controle = new AbortController();
		const timer = setTimeout(() => controle.abort(), TIMEOUT);
		try {
			const res = await fetch(url, { headers: { accept: 'application/json' }, signal: controle.signal });
			if (res.status === 404) return { dados: null };
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

async function ficha(id) {
	const [det, prof, ocup, mand] = await Promise.all([
		buscar(`${API_BASE}/deputados/${id}`),
		buscar(`${API_BASE}/deputados/${id}/profissoes`),
		buscar(`${API_BASE}/deputados/${id}/ocupacoes`),
		buscar(`${API_BASE}/deputados/${id}/mandatosExternos`)
	]);
	const d = det?.dados ?? {};
	const gab = d.ultimoStatus?.gabinete ?? {};
	return {
		id,
		nomeCivil: d.nomeCivil ?? '',
		sexo: d.sexo ?? '',
		nascimento: d.dataNascimento ?? '',
		municipioNascimento: d.municipioNascimento ?? '',
		ufNascimento: d.ufNascimento ?? '',
		escolaridade: d.escolaridade ?? '',
		situacao: d.ultimoStatus?.situacao ?? '',
		condicao: d.ultimoStatus?.condicaoEleitoral ?? '',
		site: d.urlWebsite ?? '',
		redes: (d.redeSocial ?? []).filter((u) => /^https?:\/\//.test(u)),
		gabinete: gab.sala ? { sala: gab.sala, predio: gab.predio, telefone: gab.telefone, email: gab.email } : null,
		profissoes: [...new Set((prof?.dados ?? []).map((p) => p.titulo).filter(Boolean))],
		ocupacoes: (ocup?.dados ?? [])
			.filter((o) => o.titulo || o.entidade)
			.map((o) => ({ titulo: o.titulo ?? '', entidade: o.entidade ?? '', uf: o.entidadeUF ?? '', de: o.anoInicio ?? null, ate: o.anoFim ?? null })),
		mandatos: (mand?.dados ?? []).map((m) => ({
			cargo: m.cargo ?? '',
			municipio: m.municipio ?? '',
			uf: m.siglaUf ?? '',
			de: m.anoInicio ?? null,
			ate: m.anoFim ?? null,
			partido: m.siglaPartidoEleicao ?? ''
		})),
		atualizado: new Date().toISOString()
	};
}

async function main() {
	await mkdir(DIR, { recursive: true });
	const indice = JSON.parse(await readFile(path.join(DATA_DIR, 'perfis', 'index.json'), 'utf8'));
	const limite = Date.now() - DIAS * 864e5;
	const existentes = new Set(await readdir(DIR).catch(() => []));
	const pendentes = [];
	for (const d of indice.deputados) {
		const arq = `${d.id}.json`;
		if (!existentes.has(arq)) pendentes.push(d.id);
		else if ((await stat(path.join(DIR, arq))).mtimeMs < limite) pendentes.push(d.id);
	}
	const fila = LIMITE > 0 ? pendentes.slice(0, LIMITE) : pendentes;
	console.log(`Fichas pendentes: ${pendentes.length}; buscando ${fila.length}`);
	let i = 0;
	let ok = 0;
	let falhas = 0;
	async function trabalhador() {
		while (i < fila.length) {
			const id = fila[i++];
			try {
				await writeFile(path.join(DIR, `${id}.json`), JSON.stringify(await ficha(id)) + '\n', 'utf8');
				ok += 1;
			} catch (erro) {
				falhas += 1;
				console.warn(`Falha na ficha de ${id}: ${erro?.message ?? erro}`);
			}
			await sleep(150);
		}
	}
	await Promise.all(Array.from({ length: PARALELO }, trabalhador));
	console.log(`Fichas: ${ok} gravadas, ${falhas} falhas`);
}

main().catch((erro) => {
	console.error(erro);
	process.exit(1);
});
