<script>
  import Button from './ui/Button.svelte';

  export let votos = [];
  export let onShowGraficos = () => {};
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
        </tr>
      </thead>
      <tbody>
        {#each votosExibidos as voto, i (i)}
          <tr style={`--i:${Math.min(i, 20)}`}>
            <td data-label="Foto">
              <img class="photo" src={voto.deputado_.urlFoto} alt={voto.deputado_.nome} width="48" loading="lazy" />
            </td>
            <td data-label="Deputado">
              {voto.deputado_.nome}
              <small class="sub">{voto.deputado_.siglaPartido} · {voto.deputado_.siglaUf}</small>
            </td>
            <td data-label="Partido">{voto.deputado_.siglaPartido}</td>
            <td data-label="Estado">{voto.deputado_.siglaUf}</td>
            <td data-label="Voto">
              <span class={`badge badge--${votoClasse(voto.tipoVoto)}`}>
                {voto.tipoVoto}
              </span>
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
    font-size: calc(var(--grid) * 1.9);
  }

  th {
    text-align: left;
    font-size: var(--t-small);
    font-weight: 600;
    color: var(--color-text-muted);
    padding: 0 calc(var(--grid) * 1) calc(var(--grid) * 1);
    border-bottom: 2px solid var(--color-dark);
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

  .empty {
    margin: 0;
    padding: calc(var(--grid) * 3) 0;
    color: var(--color-text-muted);
  }

  .photo {
    width: calc(var(--grid) * 4.6);
    height: calc(var(--grid) * 4.6);
    border-radius: 50%;
    background: var(--color-track);
    object-fit: cover;
    display: block;
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

  @media (max-width: 480px) {
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
</style>
