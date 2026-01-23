import { access, mkdir, writeFile } from 'fs/promises';
import path from 'path';

const API_BASE = 'https://dadosabertos.camara.leg.br/api/v2';
const START_DATE = new Date('2002-10-01T00:00:00Z');
const DATA_DIR = path.join(process.cwd(), 'static', 'data', 'deputados', 'legislaturas');

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    const error = new Error(`Falha na requisição (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function getNextLink(links = []) {
  const next = links.find((link) => link.rel === 'next');
  return next?.href ?? '';
}

async function fetchAll(url) {
  const results = [];
  let nextUrl = url;
  while (nextUrl) {
    const data = await fetchJson(nextUrl);
    const items = Array.isArray(data?.dados) ? data.dados : [];
    results.push(...items);
    nextUrl = getNextLink(data?.links);
  }
  return results;
}

async function fetchLegislaturas() {
  const url = `${API_BASE}/legislaturas?ordem=DESC&itens=100`;
  const data = await fetchJson(url);
  const items = Array.isArray(data?.dados) ? data.dados : [];
  return items.filter((leg) => {
    const inicio = leg?.dataInicio ? new Date(leg.dataInicio) : null;
    const fim = leg?.dataFim ? new Date(leg.dataFim) : null;
    if (!inicio && !fim) return false;
    if (inicio && inicio >= START_DATE) return true;
    return fim && fim >= START_DATE;
  });
}

async function fetchDeputadosPorLegislatura(id) {
  const params = new URLSearchParams({
    idLegislatura: String(id),
    ordem: 'ASC',
    itens: '100'
  });
  const url = `${API_BASE}/deputados?${params.toString()}`;
  return fetchAll(url);
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const legislaturas = await fetchLegislaturas();
  for (const leg of legislaturas) {
    const id = leg?.id;
    if (!id) continue;
    const output = path.join(DATA_DIR, `legislatura-${id}.json`);
    try {
      await access(output);
      console.log(`Ignorado (já existe): ${output}`);
      continue;
    } catch {
      // proceed
    }
    const deputados = await fetchDeputadosPorLegislatura(id);
    const payload = {
      id,
      dataInicio: leg.dataInicio ?? null,
      dataFim: leg.dataFim ?? null,
      generatedAt: new Date().toISOString(),
      deputados
    };
    await writeFile(output, JSON.stringify(payload, null, 2));
    console.log(`Salvo: ${output} (${deputados.length} deputados)`);
  }
}

main().catch((error) => {
  console.error('Falha ao baixar deputados:', error);
  process.exit(1);
});
