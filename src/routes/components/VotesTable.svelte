<script>
  import Button from './ui/Button.svelte';
  import { goto } from '$app/navigation';

  export let votos = [];
  export let onShowGraficos = () => {};
  export let emails = {};
  export let votacao = {};
  export let tratamento = 'deputado(a)';
  /** Link to a deputy's profile page, or null where there are none (the Senado) */
  export let perfilHref = null;

  function emailDe(dep) {
    return emails?.[dep?.id] || dep?.email || '';
  }

  // The whole row opens the profile; links inside it (name, e-mail) keep their own behaviour
  function abrirPerfil(evento, dep) {
    const href = perfilHref?.(dep);
    if (!href || evento.target.closest('a, button')) return;
    goto(href);
  }

  function corte(texto, n) {
    const t = (texto || '').trim();
    return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
  }

  function mailto(voto) {
    const dep = voto.deputado_ || {};
    const email = emailDe(dep);
    if (!email) return '';
    const tema = votacao?.ementa || votacao?.descricao || `votação ${votacao?.id || ''}`;
    const assunto = `Sobre o seu voto: ${corte(tema, 90)}`;
    const comoVotou =
      voto.tipoVoto === 'Ausentes'
        ? 'não há registro do seu voto'
        : `o seu voto foi "${voto.tipoVoto}"`;
    const corpo = [
      `Prezado(a) ${tratamento} ${dep.nome},`,
      '',
      `Na votação nominal de ${votacao?.data || 'plenário'}${votacao?.id ? ` (${votacao.id})` : ''}, sobre:`,
      `"${corte(tema, 400)}"`,
      votacao?.descricao ? `Resultado: ${votacao.descricao}` : '',
      '',
      `${comoVotou.charAt(0).toUpperCase()}${comoVotou.slice(1)}.`,
      '',
      '[Escreva aqui a sua mensagem]',
      '',
      'Atenciosamente,'
    ]
      .filter((linha, i, arr) => !(linha === '' && arr[i - 1] === ''))
      .join('\n');
    return `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  }
  let expandido = false;
  const limiteInicial = 12;

  function votoClasse(tipo) {
    if (!tipo) return '';
    return tipo
      .toLowerCase()
      .replace('ã', 'a')
      .replace('ç', 'c');
  }

  $: votosExibidos = expandido ? votos : votos.slice(0, limiteInicial);
</script>

<section class="table-wrap">
  {#if votos.length > 0}
    <table>
      <thead>
        <tr>
          <th colspan="2">Deputado</th>
          <th>Partido</th>
          <th>Estado</th>
          <th>Voto</th>
          <th class="th-mail"><span class="sr">Escrever</span></th>
        </tr>
      </thead>
      <tbody>
        {#each votosExibidos as voto, i (i)}
          <tr style={`--i:${Math.min(i, 20)}`} class:clicavel={perfilHref?.(voto.deputado_)} on:click={(e) => abrirPerfil(e, voto.deputado_)}>
            <td data-label="Foto">
              <span class="retrato photo"><img src={voto.deputado_.urlFoto} alt={voto.deputado_.nome} width="48" height="48" loading="lazy" /></span>
            </td>
            <td data-label="Deputado">
              {#if perfilHref?.(voto.deputado_)}
                <a class="perfil" href={perfilHref(voto.deputado_)}>{voto.deputado_.nome}</a>
              {:else}
                {voto.deputado_.nome}
              {/if}
              <small class="sub">{voto.deputado_.siglaPartido} · {voto.deputado_.siglaUf}</small>
            </td>
            <td data-label="Partido">{voto.deputado_.siglaPartido}</td>
            <td data-label="Estado">{voto.deputado_.siglaUf}</td>
            <td data-label="Voto">
              <span class={`badge badge--${votoClasse(voto.tipoVoto)}`}>
                {voto.tipoVoto}
              </span>
            </td>
            <td data-label="Escrever" class="td-mail">
              {#if mailto(voto)}
                <a
                  class="mail"
                  href={mailto(voto)}
                  aria-label={`Escrever para ${voto.deputado_.nome}`}
                  title={`Escrever para ${voto.deputado_.nome}`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
                    <path d="M4 7.5l8 6 8-6" />
                  </svg>
                </a>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if votos.length > limiteInicial}
      <div class="table-actions">
        <Button size="small" variant="primary" on:click={() => (expandido = !expandido)}>
          {expandido ? 'Ver menos' : `Ver todos os ${votos.length}`}
        </Button>
      </div>
    {/if}
  {:else}
    <p class="empty">Sem votos para este filtro.</p>
  {/if}
</section>

<style>
  .table-wrap {
    max-width: 100%;
    overflow-x: auto;
  }

  .table-actions {
    display: flex;
    justify-content: center;
    margin-top: calc(var(--grid) * 3);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: calc(var(--grid) * 2.1);
  }

  th {
    text-align: left;
    font-size: var(--t-small);
    font-weight: 600;
    color: var(--color-text-muted);
    padding: 0 calc(var(--grid) * 1) calc(var(--grid) * 1);
    border-bottom: 1px solid var(--color-rule);
  }

  td {
    padding: calc(var(--grid) * 0.8) calc(var(--grid) * 1);
    border-bottom: 1px solid var(--color-rule);
    text-align: left;
  }

  tbody tr {
    animation: row-in 600ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
    animation-delay: calc(var(--i) * 22ms);
    transition: background-color 180ms var(--ease);
  }

  tbody tr:hover {
    background: var(--color-track);
  }

  tbody tr:hover .photo {
    transform: scale(1.12);
  }

  @keyframes row-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }

  td[data-label='Deputado'] {
    font-weight: 600;
  }

  .sub {
    display: none;
    font-weight: 400;
    font-size: var(--t-small);
    color: var(--color-text-muted);
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .td-mail {
    width: 56px;
    text-align: right;
  }

  .mail {
    display: inline-grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    color: var(--color-dark);
    transition: background-color 180ms var(--ease), color 180ms var(--ease), transform 180ms var(--ease);
  }

  .mail svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .mail:hover {
    background: var(--color-dark);
    color: var(--color-light);
    transform: translateY(-2px) rotate(-6deg);
  }

  .empty {
    margin: 0;
    padding: calc(var(--grid) * 3) 0;
    color: var(--color-text-muted);
  }

  .photo {
    width: calc(var(--grid) * 4.6);
    height: calc(var(--grid) * 4.6);
    transition: transform 180ms var(--ease);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: calc(var(--grid) * 0.7);
    font-size: var(--t-small);
    font-weight: 600;
    color: var(--color-dark);
  }

  .badge::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--vote-ausentes);
  }

  .badge--sim::before {
    background: var(--vote-sim);
  }

  .badge--nao::before {
    background: var(--vote-nao);
  }

  .badge--abstencao::before {
    background: var(--vote-abstencao);
  }

  .badge--obstrucao::before {
    background: var(--vote-obstrucao);
  }

  .badge--ausentes {
    color: var(--color-text-muted);
    font-weight: 400;
  }

  @media (max-width: 600px) {
    th:nth-child(2),
    td[data-label='Partido'],
    th:nth-child(3),
    td[data-label='Estado'] {
      display: none;
    }

    .sub {
      display: block;
    }
  }
  tr.clicavel {
    cursor: pointer;
  }

  tr.clicavel:hover td {
    background: color-mix(in srgb, var(--accent-amber) 8%, transparent);
  }

  tr.clicavel:hover .perfil {
    color: var(--accent-amber-ink);
    text-decoration-color: currentColor;
  }

  .perfil {
    color: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: var(--color-rule);
    text-underline-offset: 3px;
  }

  .perfil:hover {
    color: var(--accent-amber-ink);
    text-decoration-color: currentColor;
  }
</style>
