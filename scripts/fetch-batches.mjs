import { spawn } from 'child_process';

const BATCH_SIZE = Number(process.env.VOTACOES_BATCH ?? '3');
const FROM = process.env.VOTACOES_FROM;
const TO = process.env.VOTACOES_TO;
const MAX_RETRIES = Number(process.env.VOTACOES_BATCH_RETRIES ?? '3');
const RETRY_DELAY_MS = Number(process.env.VOTACOES_BATCH_DELAY ?? '30000');

if (!FROM || !TO) {
  console.error('Defina VOTACOES_FROM=YYYY-MM e VOTACOES_TO=YYYY-MM');
  process.exit(1);
}

function parseMonth(value) {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

function formatMonth(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

const fromDate = parseMonth(FROM);
const toDate = parseMonth(TO);
if (!fromDate || !toDate) {
  console.error('Formato inválido. Use YYYY-MM.');
  process.exit(1);
}

if (fromDate > toDate) {
  console.error('VOTACOES_FROM deve ser <= VOTACOES_TO.');
  process.exit(1);
}

const months = [];
let cursor = toDate;
while (cursor >= fromDate) {
  months.push(formatMonth(cursor));
  cursor = addMonths(cursor, -BATCH_SIZE);
}

function runBatch(startMonth) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      VOTACOES_START: startMonth,
      VOTACOES_MONTHS: String(BATCH_SIZE)
    };

    const child = spawn('node', ['scripts/fetch-votacoes.mjs'], {
      stdio: 'inherit',
      env
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Falha no batch ${startMonth} (code ${code})`));
    });
  });
}

(async () => {
  for (const startMonth of months) {
    console.log(`\n=== Baixando bloco iniciando em ${startMonth} (size ${BATCH_SIZE}) ===`);
    let attempt = 0;
    while (true) {
      try {
        await runBatch(startMonth);
        break;
      } catch (error) {
        attempt += 1;
        if (attempt > MAX_RETRIES) {
          throw error;
        }
        console.warn(`Falha no batch ${startMonth}. Tentando novamente em ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
})();
