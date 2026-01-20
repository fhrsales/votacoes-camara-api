<script>
  export let votos = [];

  function votoClasse(tipo) {
    if (!tipo) return '';
    return tipo
      .toLowerCase()
      .replace('ã', 'a')
      .replace('ç', 'c');
  }
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
        {#each votos as voto}
          <tr>
            <td data-label="Foto">
              <img class="photo" src={voto.deputado_.urlFoto} alt={voto.deputado_.nome} width="48" />
            </td>
            <td data-label="Deputado">{voto.deputado_.nome}</td>
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
  {:else}
    <p class="empty">Sem votos para este filtro.</p>
  {/if}
</section>

<style>
  .table-wrap {
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: calc(var(--grid) * 1);
    border-bottom: var(--border-strong);
    text-align: left;
  }

  .empty {
    margin: 0;
    padding: calc(var(--grid) * 1.5);
    color: var(--color-text-subtle);
  }

  .photo {
    width: calc(var(--grid) * 5.5);
    height: calc(var(--grid) * 5.5);
    border-radius: 999px;
    background: var(--color-surface-muted);
    padding: calc(var(--grid) * 0.5);
    box-sizing: border-box;
    object-fit: cover;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: calc(var(--grid) * 0.5);
    padding: calc(var(--grid) * 0.5) calc(var(--grid) * 1);
    border-radius: var(--radius-pill);
    font-size: calc(var(--grid) * 1.5);
    font-weight: 600;
    border: var(--border-badge);
    background: var(--color-light);
    color: var(--color-text);
  }

  .badge::before {
    content: '';
    width: calc(var(--grid) * 1);
    height: calc(var(--grid) * 1);
    border-radius: var(--radius-pill);
    display: inline-block;
    background: var(--color-neutral);
  }

  .badge--sim {
    background: var(--color-success-soft);
    color: color-mix(in srgb, var(--color-success) 80%, var(--color-text));
  }

  .badge--sim::before {
    background: var(--color-success);
  }

  .badge--nao {
    background: var(--color-danger-soft);
    color: color-mix(in srgb, var(--color-danger) 80%, var(--color-text));
  }

  .badge--nao::before {
    background: var(--color-danger);
  }

  .badge--abstencao {
    background: var(--color-warning-soft);
    color: color-mix(in srgb, var(--color-warning) 80%, var(--color-text));
  }

  .badge--abstencao::before {
    background: var(--color-warning);
  }

  .badge--obstrucao {
    background: var(--color-info-soft);
    color: color-mix(in srgb, var(--color-info) 80%, var(--color-text));
  }

  .badge--obstrucao::before {
    background: var(--color-info);
  }

  @media (max-width: 720px) {
    th,
    td {
      padding: calc(var(--grid) * 0.5);
      font-size: calc(var(--grid) * 1.5);
    }

    .photo {
      width: calc(var(--grid) * 4);
      height: calc(var(--grid) * 4);
      padding: calc(var(--grid) * 0.5);
    }

    .badge {
      font-size: calc(var(--grid) * 1.5);
      padding: calc(var(--grid) * 0.5) calc(var(--grid) * 0.5);
    }
  }

  @media (max-width: 420px) {
    .table-wrap {
      overflow-x: visible;
    }

    table,
    tbody,
    tr,
    td {
      display: block;
    }

    thead {
      display: none;
    }

    tr {
      margin-bottom: calc(var(--grid) * 1);
      padding: calc(var(--grid) * 1);
      border-bottom: var(--border-thin);
    }

    td {
      border-bottom: none;
      padding: calc(var(--grid) * 0.5) 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: calc(var(--grid) * 1);
    }

    td::before {
      content: attr(data-label);
      font-weight: 600;
      color: var(--color-text-muted);
      font-size: calc(var(--grid) * 1.5);
    }

    td[data-label='Foto']::before {
      content: '';
    }
  }
</style>
