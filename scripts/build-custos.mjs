// What each deputy spends from the parliamentary quota (CEAP): the Câmara publishes one zipped CSV
// per year at camara.leg.br/cotas. We sum the net amounts (vlrLiquido) per deputy since February
// 2023 and write static/data/custos/{id}.json plus an index. The files carry the deputy's CPF and,
// for some suppliers, a person's CPF: neither is kept. Individual suppliers appear only as
// "Pessoa física".
import { execFileSync } from 'child_process';
import { createReadStream } from 'fs';
import { mkdir, readFile, stat, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import readline from 'readline';

const DATA_DIR = path.join(process.cwd(), 'static', 'data');
const DIR = path.join(DATA_DIR, 'custos');
const CACHE = process.env.CUSTOS_CACHE ?? path.join(os.tmpdir(), 'ceap');
const DESDE = '2023-02';
const ANO_INICIAL = 2023;

const CATEGORIAS = {
	'COMBUSTÍVEIS E LUBRIFICANTES.': 'Combustível',
	'PASSAGEM AÉREA - SIGEPA': 'Passagens aéreas',
	'PASSAGEM AÉREA - RPA': 'Passagens aéreas',
	'PASSAGEM AÉREA - REEMBOLSO': 'Passagens aéreas',
	'PASSAGENS AÉREAS': 'Passagens aéreas',
	'EMISSÃO BILHETE AÉREO': 'Passagens aéreas',
	'MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR': 'Escritório',
	'SERVIÇO DE TÁXI, PEDÁGIO E ESTACIONAMENTO': 'Táxi, pedágio e estacionamento',
	'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.': 'Divulgação do mandato',
	TELEFONIA: 'Telefone',
	'FORNECIMENTO DE ALIMENTAÇÃO DO PARLAMENTAR': 'Alimentação',
	'HOSPEDAGEM ,EXCETO DO PARLAMENTAR NO DISTRITO FEDERAL.': 'Hospedagem',
	'LOCAÇÃO OU FRETAMENTO DE VEÍCULOS AUTOMOTORES': 'Aluguel de veículos',
	'LOCAÇÃO OU FRETAMENTO DE AERONAVES': 'Fretamento de aeronaves',
	'LOCAÇÃO OU FRETAMENTO DE EMBARCAÇÕES': 'Fretamento de embarcações',
	'PASSAGENS TERRESTRES, MARÍTIMAS OU FLUVIAIS': 'Passagens terrestres e fluviais',
	'COMPLEMENTAÇÃO DO AUXÍLIO-MORADIA': 'Auxílio-moradia',
	'SERVIÇO DE SEGURANÇA PRESTADO POR EMPRESA ESPECIALIZADA.': 'Segurança',
	'CONSULTORIAS, PESQUISAS E TRABALHOS TÉCNICOS.': 'Consultorias e pesquisas',
	'ASSINATURA DE PUBLICAÇÕES': 'Assinaturas',
	'SERVIÇOS POSTAIS': 'Correios',
	'PARTICIPAÇÃO EM CURSO, PALESTRA OU EVENTO SIMILAR': 'Cursos e eventos',
	'AQUISIÇÃO DE TOKENS E CERTIFICADOS DIGITAIS': 'Certificado digital'
};
const categoria = (t) => CATEGORIAS[t] ?? (t ? t.charAt(0) + t.slice(1).toLowerCase().replace(/\.$/, '') : 'Outros');
// MEI names carry the owner's CPF ("MARIA SILVA 03841234567"): drop any long run of digits
const semDocumento = (n = '') => n.replace(/\d[\d.\-\/]{6,}\d/g, ' ').replace(/\s+/g, ' ').trim() || 'Sem nome';

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

async function baixar(ano) {
	await mkdir(CACHE, { recursive: true });
	const zip = path.join(CACHE, `Ano-${ano}.csv.zip`);
	const fresco = await stat(zip).then((s) => Date.now() - s.mtimeMs < 20 * 3600e3).catch(() => false);
	if (!fresco) {
		const res = await fetch(`https://www.camara.leg.br/cotas/Ano-${ano}.csv.zip`);
		if (!res.ok) throw new Error(`CEAP ${ano}: HTTP ${res.status}`);
		await writeFile(zip, Buffer.from(await res.arrayBuffer()));
	}
	execFileSync('unzip', ['-o', '-q', zip, '-d', CACHE]);
	return path.join(CACHE, `Ano-${ano}.csv`);
}

async function main() {
	const indice = JSON.parse(await readFile(path.join(DATA_DIR, 'perfis', 'index.json'), 'utf8'));
	const ids = new Set(indice.deputados.map((d) => String(d.id)));
	const por = new Map();
	const anoAtual = new Date().getFullYear();
	let linhas = 0;

	for (let ano = ANO_INICIAL; ano <= anoAtual; ano += 1) {
		let arquivo;
		try {
			arquivo = await baixar(ano);
		} catch (erro) {
			console.warn(erro.message);
			continue;
		}
		const rl = readline.createInterface({ input: createReadStream(arquivo, 'utf8'), crlfDelay: Infinity });
		let cab = null;
		for await (const bruta of rl) {
			const f = campos(bruta.replace(/^﻿/, ''));
			if (!cab) {
				cab = Object.fromEntries(f.map((n, i) => [n, i]));
				continue;
			}
			const id = f[cab.ideCadastro];
			if (!ids.has(id) || f[cab.codLegislatura] !== '57') continue;
			const mes = `${f[cab.numAno]}-${String(f[cab.numMes]).padStart(2, '0')}`;
			if (mes < DESDE) continue;
			const valor = Number(f[cab.vlrLiquido]) || 0;
			if (!valor) continue;
			linhas += 1;
			let d = por.get(id);
			if (!d) {
				d = { total: 0, meses: new Map(), cats: new Map(), forn: new Map(), docs: 0 };
				por.set(id, d);
			}
			d.total += valor;
			d.docs += 1;
			d.meses.set(mes, (d.meses.get(mes) ?? 0) + valor);
			const cat = categoria(f[cab.txtDescricao]);
			d.cats.set(cat, (d.cats.get(cat) ?? 0) + valor);
			const doc = (f[cab.txtCNPJCPF] ?? '').replace(/\D/g, '');
			const nome = doc.length === 11 ? 'Pessoa física' : semDocumento(f[cab.txtFornecedor] || 'Sem nome');
			const chave = doc.length === 11 ? 'pf' : nome.toUpperCase().replace(/\s+/g, ' ');
			const atual = d.forn.get(chave) ?? { nome, valor: 0, n: 0 };
			atual.valor += valor;
			atual.n += 1;
			d.forn.set(chave, atual);
		}
	}
	if (!por.size) throw new Error('Nenhuma despesa lida');

	await mkdir(DIR, { recursive: true });
	const r2 = (v) => Math.round(v * 100) / 100;
	const resumo = {};
	for (const [id, d] of por) {
		const meses = [...d.meses].sort(([a], [b]) => a.localeCompare(b));
		const mediaMensal = d.total / meses.length;
		resumo[id] = { total: r2(d.total), mediaMensal: r2(mediaMensal), meses: meses.length };
		const anos = {};
		for (const [m, v] of meses) anos[m.slice(0, 4)] = r2((anos[m.slice(0, 4)] ?? 0) + v);
		await writeFile(
			path.join(DIR, `${id}.json`),
			JSON.stringify({
				id: Number(id),
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
		path.join(DIR, 'index.json'),
		JSON.stringify({ generatedAt: new Date().toISOString(), desde: DESDE, deputados: resumo }) + '\n',
		'utf8'
	);
	console.log(`Custos: ${por.size} deputados, ${linhas} notas`);
}

main().catch((erro) => {
	console.error(erro);
	process.exit(1);
});
