import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';

const API_BASE = 'https://dadosabertos.camara.leg.br/api/v2';
const MONTHS = Number(process.env.VOTACOES_MONTHS ?? '12');
const START_MONTH = process.env.VOTACOES_START;
const DATA_DIR = path.join(process.cwd(), 'static', 'data');
const LIST_DIR = path.join(DATA_DIR, 'votacoes');
const VOTOS_DIR = path.join(DATA_DIR, 'votos');
const RETRY_ATTEMPTS = Number(process.env.VOTACOES_RETRIES ?? '4');
const RETRY_BASE_DELAY = Number(process.env.VOTACOES_RETRY_DELAY ?? '800');

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatMonth(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function monthLabel(date) {
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function monthLabelFromValue(value) {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  const index = month - 1;
  if (index < 0 || index >= monthNames.length) return value;
  return `${monthNames[index]} ${year}`;
}

function isMonthValue(value) {
  return /^\d{4}-\d{2}$/.test(value);
}

function sortMonthValuesDesc(a, b) {
  return b.localeCompare(a);
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, errorMessage) {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' }
      });
      if (!response.ok) {
        const error = new Error(`${errorMessage ?? 'Falha na requisição'} (${response.status})`);
        error.status = response.status;
        throw error;
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_ATTEMPTS) {
        const baseDelay = error?.status === 504 ? RETRY_BASE_DELAY * 4 : RETRY_BASE_DELAY;
        await sleep(baseDelay * (attempt + 1));
      }
    }
  }
  throw lastError ?? new Error(errorMessage ?? 'Falha na requisição');
}

function getNextLink(links = []) {
  const next = links.find((link) => link.rel === 'next');
  return next?.href ?? '';
}

async function fetchAll(url, errorMessage) {
  const results = [];
  let nextUrl = url;
  while (nextUrl) {
    const data = await fetchJson(nextUrl, errorMessage);
    const items = Array.isArray(data?.dados) ? data.dados : [];
    results.push(...items);
    nextUrl = getNextLink(data?.links);
    if (nextUrl) await sleep(200);
  }
  return results;
}

async function fetchResumoTexto(id) {
  try {
    const detalhesData = await fetchJson(`${API_BASE}/votacoes/${id}`, `Falha ao buscar detalhes (${id})`);
    const detalhes = detalhesData?.dados ?? {};
    const afetadas = detalhes?.proposicoesAfetadas ?? [];
    const objetos = detalhes?.objetosPossiveis ?? [];
    let ementa = afetadas[0]?.ementa || objetos[0]?.ementa || '';

    if (!ementa) {
      const uriProposicao = detalhes?.uriProposicaoObjeto || afetadas[0]?.uri || objetos[0]?.uri || '';
      const idProposicao = uriProposicao.split('/').pop();
      if (idProposicao) {
        try {
          const propData = await fetchJson(
            `${API_BASE}/proposicoes/${idProposicao}`,
            `Falha ao buscar proposição (${idProposicao})`
          );
          ementa = propData?.dados?.ementa || '';
        } catch {
          ementa = '';
        }
      }
    }

    return ementa || detalhes.ementa || '';
  } catch {
    return '';
  }
}

async function ensureDirs() {
  await mkdir(LIST_DIR, { recursive: true });
  await mkdir(VOTOS_DIR, { recursive: true });
}

function buildMonthsList() {
  const now = START_MONTH ? new Date(`${START_MONTH}-01T00:00:00Z`) : new Date();
  const months = [];
  for (let i = 0; i < MONTHS; i += 1) {
    const date = addMonths(now, -i);
    months.push({
      value: formatMonth(date),
      label: monthLabel(date)
    });
  }
  return months;
}

async function writeJson(filePath, data) {
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(filePath, payload, 'utf8');
}

async function loadMonthIds(filePath) {
  try {
    const data = JSON.parse(await readFile(filePath, 'utf8'));
    const ids = Array.isArray(data?.votacoes)
      ? data.votacoes.map((item) => String(item?.id)).filter(Boolean)
      : [];
    return new Set(ids);
  } catch {
    return new Set();
  }
}

async function main() {
  await ensureDirs();
  const months = buildMonthsList();
  const generatedAt = new Date().toISOString();
  const votacoesIds = new Set();

  for (const month of months) {
    const [year, monthNum] = month.value.split('-').map(Number);
    const start = monthStart(new Date(year, monthNum - 1, 1));
    const end = monthEnd(start);
    const params = new URLSearchParams({
      dataInicio: formatDate(start),
      dataFim: formatDate(end),
      itens: '100',
      ordem: 'DESC'
    });
    const url = `${API_BASE}/votacoes?${params.toString()}`;
    const lista = await fetchAll(url, `Falha ao listar votações (${month.value})`);
    const resultadoRegex = /Sim:\s*\d+|Não:\s*\d+|Abstenç[ãa]o:\s*\d+|Obstruç[ãa]o:\s*\d+|Total:\s*\d+/i;
    const listaFiltrada = lista
      .map((item) => {
        const descricao = item?.descricao || '';
        const hasResultado = resultadoRegex.test(descricao);
        return { ...item, hasResultado };
      })
      .filter((item) => item.hasResultado === true);

    listaFiltrada.forEach((item) => {
      if (item?.id != null) votacoesIds.add(String(item.id));
    });

    const monthPath = path.join(LIST_DIR, `${month.value}.json`);
    const existingIds = await loadMonthIds(monthPath);
    const newIds = new Set(listaFiltrada.map((item) => String(item?.id)).filter(Boolean));
    const hasSameSize = existingIds.size === newIds.size;
    const hasAllIds = hasSameSize && Array.from(newIds).every((id) => existingIds.has(id));

    if (!hasAllIds) {
      await writeJson(monthPath, {
        mes: month.value,
        generatedAt,
        votacoes: listaFiltrada
      });
    }

    await sleep(250);
  }

  const existingMonthFiles = await readdir(LIST_DIR).catch(() => []);
  const existingValues = existingMonthFiles
    .filter((file) => file.endsWith('.json') && file !== 'index.json')
    .map((file) => file.replace('.json', ''))
    .filter(isMonthValue);

  const monthValues = Array.from(
    new Set([...months.map((item) => item.value), ...existingValues])
  ).sort(sortMonthValuesDesc);

  const mergedMonths = monthValues.map((value) => ({
    value,
    label: monthLabelFromValue(value)
  }));

  await writeJson(path.join(LIST_DIR, 'index.json'), {
    generatedAt,
    meses: mergedMonths
  });

  const votesExisting = new Set(await readdir(VOTOS_DIR).catch(() => []));
  const votosIds = Array.from(votacoesIds);
  const pendingVotes = votosIds.filter((id) => !votesExisting.has(`${id}.json`));

  for (const id of pendingVotes) {
    try {
      const votosUrl = `${API_BASE}/votacoes/${id}/votos`;
      const votos = await fetchAll(votosUrl, `Falha ao buscar votos (${id})`);
      const votosFiltrados = votos.filter((voto) => voto.tipoVoto !== 'Artigo 17');
      const resumoTexto = await fetchResumoTexto(id);

      await writeJson(path.join(VOTOS_DIR, `${id}.json`), {
        id,
        generatedAt,
        resumoTexto,
        votos: votosFiltrados
      });

      await sleep(250);
    } catch (error) {
      console.warn(`Falha ao buscar votos para ${id}:`, error?.message ?? error);
    }
  }

  const updatedFiles = await readdir(VOTOS_DIR).catch(() => []);
  const availableIds = updatedFiles
    .filter((file) => file.endsWith('.json') && file !== 'index.json')
    .map((file) => file.replace('.json', ''));

  await writeJson(path.join(VOTOS_DIR, 'index.json'), {
    generatedAt,
    ids: availableIds
  });

  try {
    const previous = JSON.parse(
      await readFile(path.join(DATA_DIR, 'last-run.json'), 'utf8')
    );
    await writeJson(path.join(DATA_DIR, 'last-run.json'), {
      ...previous,
      generatedAt
    });
  } catch {
    await writeJson(path.join(DATA_DIR, 'last-run.json'), { generatedAt });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
