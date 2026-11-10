// Senado: who each senator is. Full name, birth, academic record, professions, Senado terms and
// the committees they chaired, in the same shape as the deputies' records so the profile page
// reads both. One file per senator in static/data/senado/bio/, refreshed after BIO_DIAS days.
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises';
import path from 'path';

const API = 'https://legis.senado.leg.br/dadosabertos';
const DIR = path.join(process.cwd(), 'static', 'data', 'senado');
const SAIDA = path.join(DIR, 'bio');
const TIMEOUT = Number(process.env.VOTACOES_FETCH_TIMEOUT ?? '30000');
const RETRIES = Number(process.env.VOTACOES_RETRIES ?? '3');
const PARALELO = Number(process.env.BIO_PARALELO ?? '3');
const LIMITE = Number(process.env.BIO_LIMITE ?? '0');
const DIAS = Number(process.env.BIO_DIAS ?? '30');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lista = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const ano = (d) => (d ? Number(String(d).slice(0, 4)) : null);

async function buscar(url) {
	let ultimo;
	for (let i = 0; i <= RETRIES; i += 1) {
		const controle = new AbortController();
		const timer = setTimeout(() => controle.abort(), TIMEOUT);
		try {
			const res = await fetch(url, { headers: { accept: 'application/json' }, signal: controle.signal });
			if (res.status === 404) return null;
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return await res.json();
		} catch (erro) {
			ultimo = erro;
			await sleep(800 * (i + 1));
		} finally {
			clearTimeout(timer);
		}
	}
	throw ultimo;
}

const titulo = (s = '') => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// Highest level reached, then the higher-education courses: "Superior: Administração, Direito"
const GRAUS = ['Doutorado', 'Mestrado', 'Pós-Graduação', 'Especialização', 'Superior', 'Segundo Grau', 'Primeiro Grau', 'Primário'];
function escolaridade(cursos) {
	if (!cursos.length) return '';
	const nivel = (c) => {
		const i = GRAUS.findIndex((g) => (c.GrauInstrucao ?? '').toLowerCase().startsWith(g.toLowerCase().slice(0, 6)));
		return i < 0 ? GRAUS.length : i;
	};
	const topo = Math.min(...cursos.map(nivel));
	const grau = topo < GRAUS.length ? GRAUS[topo] : cursos[0].GrauInstrucao ?? '';
	const superiores = [...new Set(cursos.filter((c) => nivel(c) <= 4).map((c) => c.NomeCurso).filter(Boolean))];
	return superiores.length ? `${grau}: ${superiores.join(', ')}` : grau;
}

async function ficha(id) {
	const [det, prof, acad, mand, cargos] = await Promise.all([
		buscar(`${API}/senador/${id}`),
		buscar(`${API}/senador/${id}/profissao`),
		buscar(`${API}/senador/${id}/historicoAcademico`),
		buscar(`${API}/senador/${id}/mandatos`),
		buscar(`${API}/senador/${id}/cargos`)
	]);
	const p = det?.DetalheParlamentar?.Parlamentar ?? {};
	const ident = p.IdentificacaoParlamentar ?? {};
	const basicos = p.DadosBasicosParlamentar ?? {};
	const tel = lista(p.Telefones?.Telefone)[0]?.NumeroTelefone;
	const cursos = lista(acad?.HistoricoAcademicoParlamentar?.Parlamentar?.HistoricoAcademico?.Curso);
	const profissoes = lista(prof?.HistoricoAcademicoParlamentar?.Parlamentar?.Profissoes?.Profissao)
		.map((x) => x.NomeProfissao)
		.filter(Boolean);

	const mandatos = lista(mand?.MandatoParlamentar?.Parlamentar?.Mandatos?.Mandato)
		.map((m) => {
			const de = ano(m.PrimeiraLegislaturaDoMandato?.DataInicio);
			const ate = ano(m.SegundaLegislaturaDoMandato?.DataFim ?? m.PrimeiraLegislaturaDoMandato?.DataFim);
			const partidos = lista(m.Partidos?.Partido);
			return {
				cargo: m.DescricaoParticipacao === 'Titular' ? 'Senador(a)' : `Senador(a) · ${m.DescricaoParticipacao}`,
				municipio: '',
				uf: m.UfParlamentar ?? '',
				de,
				ate,
				partido: partidos[partidos.length - 1]?.Sigla ?? ''
			};
		})
		.filter((m) => m.de);

	// Committees and fronts they led; plain membership is left out
	const ocupacoes = lista(cargos?.CargoParlamentar?.Parlamentar?.Cargos?.Cargo)
		.filter((c) => /PRESIDENTE|L[ÍI]DER|RELATOR-GERAL/i.test(c.DescricaoCargo ?? ''))
		.map((c) => ({
			titulo: titulo(c.DescricaoCargo),
			entidade: c.IdentificacaoComissao?.NomeComissao ?? '',
			uf: '',
			de: ano(c.DataInicio),
			ate: ano(c.DataFim)
		}))
		.sort((a, b) => (b.de ?? 0) - (a.de ?? 0))
		.slice(0, 12);

	return {
		id,
		nomeCivil: ident.NomeCompletoParlamentar ?? '',
		sexo: ident.SexoParlamentar === 'Feminino' ? 'F' : ident.SexoParlamentar ? 'M' : '',
		nascimento: basicos.DataNascimento ?? '',
		municipioNascimento: basicos.Naturalidade ?? '',
		ufNascimento: basicos.UfNaturalidade ?? '',
		escolaridade: escolaridade(cursos),
		situacao: '',
		condicao: '',
		site: ident.UrlPaginaParlamentar ?? '',
		redes: [],
		gabinete: ident.EmailParlamentar || tel
			? { sala: basicos.EnderecoParlamentar ?? '', predio: '', telefone: tel ? `${tel.slice(0, 4)}-${tel.slice(4)}` : '', email: ident.EmailParlamentar ?? '' }
			: null,
		profissoes: [...new Set(profissoes)],
		ocupacoes,
		mandatos,
		atualizado: new Date().toISOString()
	};
}

async function main() {
	await mkdir(SAIDA, { recursive: true });
	// Everyone who cast a vote in the roll calls we keep
	const ids = new Set();
	for (const f of await readdir(path.join(DIR, 'votos'))) {
		if (!f.endsWith('.json') || f === 'index.json') continue;
		const { votos = [] } = JSON.parse(await readFile(path.join(DIR, 'votos', f), 'utf8'));
		for (const v of votos) if (v.deputado_?.id) ids.add(v.deputado_.id);
	}
	const limite = Date.now() - DIAS * 864e5;
	const existentes = new Set(await readdir(SAIDA).catch(() => []));
	const pendentes = [];
	for (const id of ids) {
		const arq = `${id}.json`;
		if (!existentes.has(arq) || (await stat(path.join(SAIDA, arq))).mtimeMs < limite) pendentes.push(id);
	}
	const fila = LIMITE > 0 ? pendentes.slice(0, LIMITE) : pendentes;
	console.log(`Senado: ${ids.size} senadores, ${pendentes.length} fichas pendentes; buscando ${fila.length}`);
	let i = 0;
	let ok = 0;
	let falhas = 0;
	async function trabalhador() {
		while (i < fila.length) {
			const id = fila[i++];
			try {
				await writeFile(path.join(SAIDA, `${id}.json`), JSON.stringify(await ficha(id)) + '\n', 'utf8');
				ok += 1;
			} catch (erro) {
				falhas += 1;
				console.warn(`Falha na ficha de ${id}: ${erro?.message ?? erro}`);
			}
			await sleep(150);
		}
	}
	await Promise.all(Array.from({ length: PARALELO }, trabalhador));
	console.log(`Fichas do Senado: ${ok} gravadas, ${falhas} falhas`);
}

main().catch((erro) => {
	console.error(erro);
	process.exit(1);
});
