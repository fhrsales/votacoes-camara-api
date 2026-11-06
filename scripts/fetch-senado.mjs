// Senado Federal: nominal plenary votes, written in the same shape as the Câmara data so the
// site can read either house the same way. Output goes to static/data/senado.
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const API = 'https://legis.senado.leg.br/dadosabertos';
const MONTHS = Number(process.env.SENADO_MONTHS ?? process.env.VOTACOES_MONTHS ?? '2');
const START_MONTH = process.env.SENADO_START ?? process.env.VOTACOES_START;
const RETRIES = Number(process.env.VOTACOES_RETRIES ?? '4');
const RETRY_DELAY = Number(process.env.VOTACOES_RETRY_DELAY ?? '1000');
const TIMEOUT = Number(process.env.VOTACOES_FETCH_TIMEOUT ?? '30000');

const DATA_DIR = path.join(process.cwd(), 'static', 'data', 'senado');
const LIST_DIR = path.join(DATA_DIR, 'votacoes');
const VOTOS_DIR = path.join(DATA_DIR, 'votos');
const PESSOAS_DIR = path.join(DATA_DIR, 'deputados');

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const pad2 = (n) => String(n).padStart(2, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  let ultimo;
  for (let i = 0; i <= RETRIES; i += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);
      const resp = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} em ${url}`);
      return await resp.json();
    } catch (error) {
      ultimo = error;
      if (i < RETRIES) await sleep(RETRY_DELAY * (i + 1));
    }
  }
  throw ultimo;
}

async function writeJson(file, data) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

// Senado vote codes -> the five kinds the site draws. Everything that is not a cast vote
// (absent, on leave, on mission, presiding, present without voting) counts as absent.
function tipoDoVoto(sigla) {
  if (sigla === 'Sim' || sigla === 'Não' || sigla === 'Abstenção' || sigla === 'Obstrução') return sigla;
  if (sigla === 'P-OD') return 'Obstrução';
  return 'Ausentes';
}

const SITUACOES = {
  AP: 'Atividade parlamentar',
  NCom: 'Não compareceu',
  LS: 'Licença saúde',
  LP: 'Licença particular',
  MIS: 'Missão',
  'P-NRV': 'Presente, não registrou voto',
  'P-OD': 'Obstrução declarada',
  'Presidente (art. 51 RISF)': 'Presidindo a sessão'
};

function meses() {
  const base = START_MONTH ? new Date(`${START_MONTH}-01T12:00:00`) : new Date();
  return Array.from({ length: MONTHS }, (_, i) => new Date(base.getFullYear(), base.getMonth() - i, 1));
}

async function main() {
  await mkdir(LIST_DIR, { recursive: true });
  await mkdir(VOTOS_DIR, { recursive: true });
  await mkdir(PESSOAS_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();

  for (const inicio of meses()) {
    const ano = inicio.getFullYear();
    const mes = inicio.getMonth() + 1;
    const fim = new Date(ano, mes, 0);
    const valor = `${ano}-${pad2(mes)}`;
    const url = `${API}/votacao?dataInicio=${valor}-01&dataFim=${valor}-${pad2(fim.getDate())}`;
    const lista = await fetchJson(url);
    const abertas = (Array.isArray(lista) ? lista : []).filter(
      (v) => v?.votacaoSecreta !== 'S' && Array.isArray(v?.votos) && v.votos.length
    );

    const votacoes = [];
    for (const v of abertas) {
      const id = String(v.codigoSessaoVotacao);
      const resultado = v.resultadoVotacao === 'A' ? 'Aprovado' : v.resultadoVotacao === 'R' ? 'Rejeitado' : '';
      const descricao = [resultado, v.descricaoVotacao].filter(Boolean).join('. ');
      const dataHora = `${v.dataSessao}T00:00:00`;
      votacoes.push({
        id,
        data: v.dataSessao,
        dataHoraRegistro: dataHora,
        sequencial: v.sequencialVotacao ?? 0,
        siglaOrgao: 'PLEN',
        identificacao: v.identificacao ?? '',
        descricao,
        hasResultado: true
      });
      await writeJson(path.join(VOTOS_DIR, `${id}.json`), {
        id,
        generatedAt,
        resumoTexto: v.ementa || v.descricaoVotacao || '',
        votos: v.votos.map((p) => ({
          tipoVoto: tipoDoVoto(p.siglaVotoParlamentar),
          situacao: SITUACOES[p.siglaVotoParlamentar] ?? p.descricaoVotoParlamentar ?? null,
          dataRegistroVoto: dataHora,
          deputado_: {
            id: p.codigoParlamentar,
            nome: p.nomeParlamentar,
            siglaPartido: p.siglaPartidoParlamentar,
            siglaUf: p.siglaUFParlamentar,
            sexo: p.sexoParlamentar,
            urlFoto: `https://www.senado.leg.br/senadores/img/fotos-oficiais/senador${p.codigoParlamentar}.jpg`
          }
        }))
      });
    }
    votacoes.sort((a, b) => b.data.localeCompare(a.data) || b.sequencial - a.sequencial);
    await writeJson(path.join(LIST_DIR, `${valor}.json`), { mes: valor, generatedAt, votacoes });
    console.log(`Senado ${valor}: ${votacoes.length} votações nominais`);
    await sleep(300);
  }

  // Indexes, rebuilt from what is on disk
  const arquivos = (await readdir(LIST_DIR)).filter((f) => /^\d{4}-\d{2}\.json$/.test(f));
  const comDados = [];
  for (const f of arquivos) {
    const data = JSON.parse(await readFile(path.join(LIST_DIR, f), 'utf8'));
    if (data?.votacoes?.length) comDados.push(f.replace('.json', ''));
  }
  comDados.sort((a, b) => b.localeCompare(a));
  await writeJson(path.join(LIST_DIR, 'index.json'), {
    generatedAt,
    meses: comDados.map((value) => {
      const [a, m] = value.split('-').map(Number);
      return { value, label: `${MESES[m - 1]} ${a}` };
    })
  });
  const ids = (await readdir(VOTOS_DIR))
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => f.replace('.json', ''));
  await writeJson(path.join(VOTOS_DIR, 'index.json'), { generatedAt, ids });

  // Contact e-mails and women senators in office
  try {
    const dados = await fetchJson(`${API}/senador/lista/atual`);
    const lista = dados?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar ?? [];
    const emails = {};
    const mulheres = [];
    for (const p of lista) {
      const ident = p.IdentificacaoParlamentar ?? {};
      const id = Number(ident.CodigoParlamentar);
      if (!id) continue;
      if (ident.EmailParlamentar) emails[id] = ident.EmailParlamentar;
      if (ident.SexoParlamentar === 'Feminino') mulheres.push(id);
    }
    if (Object.keys(emails).length) {
      await writeJson(path.join(PESSOAS_DIR, 'emails.json'), { emails, mulheres });
    }
  } catch (error) {
    console.warn('Falha ao atualizar senadores:', error?.message ?? error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
