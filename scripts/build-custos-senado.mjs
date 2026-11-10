// Senado: what each senator spends from the parliamentary quota (CEAPS). The Senado publishes one
// CSV per year (Latin-1, ';'), with the senator by name only, so we match names to the senators in
// our roll calls. Individual suppliers (a CPF) appear only as "Pessoa física". Writes
// static/data/senado/custos/{id}.json and index.json, in the same shape as the Câmara's.
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const DIR = path.join(process.cwd(), 'static', 'data', 'senado');
const SAIDA = path.join(DIR, 'custos');
const DESDE = '2023-02';
const ANO_INICIAL = 2023;

const CATEGORIAS = [
	[/^locomo/i, 'Locomoção, hospedagem e combustível'],
	[/^passagens/i, 'Passagens'],
	[/^aluguel/i, 'Escritório'],
	[/^divulga/i, 'Divulgação do mandato'],
	[/^contrata/i, 'Consultorias e assessorias'],
	[/^aquisi/i, 'Material de escritório'],
	[/seguran/i, 'Segurança']
];
const categoria = (t = '') => CATEGORIAS.find(([re]) => re.test(t.trim()))?.[1] ?? (t.trim() || 'Outros');
// MEI names carry the owner's CPF ("MARIA SILVA 03841234567"): drop any long run of digits
const semDocumento = (n = '') => n.replace(/\d[\d.\-\/]{6,}\d/g, ' ').replace(/\s+/g, ' ').trim() || 'Sem nome';
const normal = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function campos(linha) {
	const out = [];
	let atual = '';
	let aspas = false;
	for (let i = 0; i < linha.length; i += 1) {
		const c = linha[i];
		if (c === '"') {
			if (aspas && linha[i + 1] === '"') {
				atual += '"';
				i += 1;
			} else aspas = !aspas;
		} else if (c === ';' && !aspas) {
			out.push(atual);
			atual = '';
		} else atual += c;
	}
	out.push(atual);
	return out;
}

// Records, joining lines broken inside a quoted field
function* registros(texto) {
	let pendente = '';
	for (const linha of texto.split(/\r?\n/)) {
		pendente = pendente ? `${pendente} ${linha}` : linha;
		if ((pendente.match(/"/g) ?? []).length % 2 === 0) {
			if (pendente.trim()) yield campos(pendente);
			pendente = '';
		}
	}
}

async function main() {
	// Senators in our roll calls: id and the name the Senado uses
	const porNome = new Map();
	for (const f of await readdir(path.join(DIR, 'votos'))) {
		if (!f.endsWith('.json') || f === 'index.json') continue;
		const { votos = [] } = JSON.parse(await readFile(path.join(DIR, 'votos', f), 'utf8'));
		for (const v of votos) if (v.deputado_?.id) porNome.set(normal(v.deputado_.nome), v.deputado_.id);
	}

	// Names differ now and then ("Dr. Samuel Araújo" / "SAMUEL ARAUJO", "Weverton" /
	// "WEVERTON ROCHA"): fall back to the one senator whose name words all appear in the other
	const semTitulo = (n) => n.replace(/^(DR|DRA|PROF|PROFA|DELEGADO|DELEGADA|PASTOR)\s+/, '');
	const cache = new Map();
	function acharId(bruto) {
		const n = normal(bruto);
		if (cache.has(n)) return cache.get(n);
		let id = porNome.get(n);
		if (!id) {
			const a = semTitulo(n).split(' ');
			const achados = [...porNome].filter(([nome]) => {
				const b = semTitulo(nome).split(' ');
				return a.every((t) => b.includes(t)) || b.every((t) => a.includes(t));
			});
			if (new Set(achados.map(([, i]) => i)).size === 1) id = achados[0][1];
		}
		cache.set(n, id);
		return id;
	}

	const por = new Map();
	const semPar = new Set();
	let notas = 0;
	for (let ano = ANO_INICIAL; ano <= new Date().getFullYear(); ano += 1) {
		const res = await fetch(`https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_${ano}.csv`);
		if (!res.ok) {
			console.warn(`CEAPS ${ano}: HTTP ${res.status}`);
			continue;
		}
		const texto = new TextDecoder('latin1').decode(await res.arrayBuffer());
		let cab = null;
		for (const f of registros(texto)) {
			if (!cab) {
				if (f[0] === 'ANO') cab = Object.fromEntries(f.map((n, i) => [n, i]));
				continue;
			}
			const mes = `${f[cab.ANO]}-${String(f[cab.MES]).padStart(2, '0')}`;
			if (mes < DESDE) continue;
			const id = acharId(f[cab.SENADOR]);
			if (!id) {
				semPar.add(f[cab.SENADOR]);
				continue;
			}
			const valor = Number(String(f[cab.VALOR_REEMBOLSADO] ?? '').replace(/\./g, '').replace(',', '.')) || 0;
			if (!valor) continue;
			notas += 1;
			let d = por.get(id);
			if (!d) {
				d = { total: 0, meses: new Map(), cats: new Map(), forn: new Map(), docs: 0 };
				por.set(id, d);
			}
			d.total += valor;
			d.docs += 1;
			d.meses.set(mes, (d.meses.get(mes) ?? 0) + valor);
			const cat = categoria(f[cab.TIPO_DESPESA]);
			d.cats.set(cat, (d.cats.get(cat) ?? 0) + valor);
			const doc = (f[cab.CNPJ_CPF] ?? '').replace(/\D/g, '');
			const nome = doc.length === 11 ? 'Pessoa física' : semDocumento(f[cab.FORNECEDOR] || 'Sem nome');
			const chave = doc.length === 11 ? 'pf' : nome.toUpperCase().replace(/\s+/g, ' ');
			const atual = d.forn.get(chave) ?? { nome, valor: 0, n: 0 };
			atual.valor += valor;
			atual.n += 1;
			d.forn.set(chave, atual);
		}
	}
	if (!por.size) throw new Error('Nenhuma despesa lida');
	if (semPar.size) console.warn(`Sem correspondência (fora das votações nominais): ${[...semPar].join(', ')}`);

	await mkdir(SAIDA, { recursive: true });
	const r2 = (v) => Math.round(v * 100) / 100;
	const resumo = {};
	for (const [id, d] of por) {
		const meses = [...d.meses].sort(([a], [b]) => a.localeCompare(b));
		const mediaMensal = d.total / meses.length;
		resumo[id] = { total: r2(d.total), mediaMensal: r2(mediaMensal), meses: meses.length };
		const anos = {};
		for (const [m, v] of meses) anos[m.slice(0, 4)] = r2((anos[m.slice(0, 4)] ?? 0) + v);
		await writeFile(
			path.join(SAIDA, `${id}.json`),
			JSON.stringify({
				id,
				total: r2(d.total),
				mediaMensal: r2(mediaMensal),
				documentos: d.docs,
				anos,
				meses: meses.map(([m, v]) => [m, r2(v)]),
				categorias: [...d.cats].sort((a, b) => b[1] - a[1]).map(([nome, valor]) => ({ nome, valor: r2(valor) })),
				fornecedores: [...d.forn.values()]
					.sort((a, b) => b.valor - a.valor)
					.slice(0, 8)
					.map((x) => ({ nome: x.nome, valor: r2(x.valor), notas: x.n }))
			}) + '\n',
			'utf8'
		);
	}
	await writeFile(
		path.join(SAIDA, 'index.json'),
		JSON.stringify({ generatedAt: new Date().toISOString(), desde: DESDE, senadores: resumo }) + '\n',
		'utf8'
	);
	console.log(`Custos do Senado: ${por.size} senadores, ${notas} notas`);
}

main().catch((erro) => {
	console.error(erro);
	process.exit(1);
});
