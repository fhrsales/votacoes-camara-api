import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';

const API_BASE = 'https://dadosabertos.camara.leg.br/api/v2';
const MONTHS = Number(process.env.VOTACOES_MONTHS ?? '12');
const START_MONTH = process.env.VOTACOES_START;
const DAYS = Number(process.env.VOTACOES_DAYS ?? '0');
const START_DATE = process.env.VOTACOES_START_DATE;
const DATA_DIR = path.join(process.cwd(), 'static', 'data');
const LIST_DIR = path.join(DATA_DIR, 'votacoes');
const VOTOS_DIR = path.join(DATA_DIR, 'votos');
const RETRY_ATTEMPTS = Number(process.env.VOTACOES_RETRIES ?? '4');
const RETRY_BASE_DELAY = Number(process.env.VOTACOES_RETRY_DELAY ?? '800');
const MAX_RANGE_SPLITS = Number(process.env.VOTACOES_MAX_RANGE_SPLITS ?? '4');
const FETCH_TIMEOUT_MS = Number(process.env.VOTACOES_FETCH_TIMEOUT ?? '15000');

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

function dayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rangeDays(start, end) {
  const ms = end.getTime() - start.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1;
}

function splitRange(start, end) {
  const mid = new Date(start.getTime());
  mid.setDate(mid.getDate() + Math.floor(rangeDays(start, end) / 2));
  const leftEnd = new Date(mid.getFullYear(), mid.getMonth(), mid.getDate());
  const rightStart = new Date(leftEnd.getTime());
  rightStart.setDate(rightStart.getDate() + 1);
  return [
    [start, leftEnd],
    [rightStart, end]
  ];
}

async function fetchJson(url, errorMessage) {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const error = new Error(`${errorMessage ?? 'Falha na requisição'} (${response.status})`);
        error.status = response.status;
        throw error;
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_ATTEMPTS) {
        const timeoutCode = error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';
        const aborted = error?.name === 'AbortError';
        const isTimeout = timeoutCode || aborted;
        const baseDelay = error?.status === 504 || isTimeout ? RETRY_BASE_DELAY * 4 : RETRY_BASE_DELAY;
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

async function fetchVotacoesRange(start, end, errorMessage, depth = 0) {
  const params = new URLSearchParams({
    dataInicio: formatDate(start),
    dataFim: formatDate(end),
    itens: '100',
    ordem: 'DESC'
  });
  const url = `${API_BASE}/votacoes?${params.toString()}`;

  try {
    return await fetchAll(url, errorMessage);
  } catch (error) {
    const canSplit = depth < MAX_RANGE_SPLITS && rangeDays(start, end) > 1;
    if (error?.status === 504 && canSplit) {
      const ranges = splitRange(start, end);
      const results = [];
      for (const [rangeStart, rangeEnd] of ranges) {
        const label = `${formatDate(rangeStart)}..${formatDate(rangeEnd)}`;
        const chunk = await fetchVotacoesRange(
          rangeStart,
          rangeEnd,
          `${errorMessage} (${label})`,
          depth + 1
        );
        results.push(...chunk);
        await sleep(200);
      }
      return results;
    }
    throw error;
  }
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

function buildDaysList() {
  const base = START_DATE ? new Date(`${START_DATE}T00:00:00`) : new Date();
  const start = dayStart(base);
  const days = [];
  for (let i = 0; i < DAYS; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() - i);
    days.push(date);
  }
  return days;
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

async function loadMonthData(filePath) {
  try {
    const data = JSON.parse(await readFile(filePath, 'utf8'));
    const votacoes = Array.isArray(data?.votacoes) ? data.votacoes : [];
    return { ...data, votacoes };
  } catch {
    return { votacoes: [] };
  }
}

function sortByDataHoraDesc(a, b) {
  const aValue = a?.dataHoraRegistro ? new Date(a.dataHoraRegistro).getTime() : 0;
  const bValue = b?.dataHoraRegistro ? new Date(b.dataHoraRegistro).getTime() : 0;
  return bValue - aValue;
}

async function main() {
  await ensureDirs();
  const useDays = DAYS > 0;
  const months = useDays ? [] : buildMonthsList();
  const days = useDays ? buildDaysList() : [];
  const generatedAt = new Date().toISOString();
  const votacoesIds = new Set();

  if (useDays) {
    const resultadoRegex = /Sim:\s*\d+|Não:\s*\d+|Abstenç[ãa]o:\s*\d+|Obstruç[ãa]o:\s*\d+|Total:\s*\d+/i;
    const updatesByMonth = new Map();

    for (const date of days) {
      const start = dayStart(date);
      const end = dayStart(date);
      const lista = await fetchVotacoesRange(
        start,
        end,
        `Falha ao listar votações (${formatDate(start)})`
      );
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

      const monthValue = formatMonth(start);
      const existing = updatesByMonth.get(monthValue) ?? [];
      updatesByMonth.set(monthValue, existing.concat(listaFiltrada));

      await sleep(200);
    }

    for (const [monthValue, updates] of updatesByMonth.entries()) {
      const monthPath = path.join(LIST_DIR, `${monthValue}.json`);
      const existingData = await loadMonthData(monthPath);
      const merged = new Map(
        existingData.votacoes.map((item) => [String(item?.id), item]).filter(([id]) => id !== 'undefined')
      );

      updates.forEach((item) => {
        if (item?.id != null) merged.set(String(item.id), item);
      });

      const mergedList = Array.from(merged.values()).sort(sortByDataHoraDesc);
      await writeJson(monthPath, {
        mes: monthValue,
        generatedAt,
        votacoes: mergedList
      });
    }
  } else {
    for (const month of months) {
      const [year, monthNum] = month.value.split('-').map(Number);
      const start = monthStart(new Date(year, monthNum - 1, 1));
      const end = monthEnd(start);
      const lista = await fetchVotacoesRange(
        start,
        end,
        `Falha ao listar votações (${month.value})`
      );
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
  }

  const existingMonthFiles = await readdir(LIST_DIR).catch(() => []);
  const existingValues = existingMonthFiles
    .filter((file) => file.endsWith('.json') && file !== 'index.json')
    .map((file) => file.replace('.json', ''))
    .filter(isMonthValue);

  const newValues = useDays ? days.map((date) => formatMonth(date)) : months.map((item) => item.value);
  const monthValues = Array.from(new Set([...newValues, ...existingValues])).sort(
    sortMonthValuesDesc
  );

  const monthsWithData = await Promise.all(
    monthValues.map(async (value) => {
      const monthPath = path.join(LIST_DIR, `${value}.json`);
      const data = await loadMonthData(monthPath);
      return data.votacoes.length > 0 ? value : null;
    })
  );

  const mergedMonths = monthsWithData
    .filter(Boolean)
    .map((value) => ({
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
