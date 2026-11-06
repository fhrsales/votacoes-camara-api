<script>
  import { afterNavigate } from '$app/navigation';
  import '../app.css';

  afterNavigate((nav) => {
    const url = nav?.to?.url;
    if (!url || typeof window === 'undefined') return;
    const path = `${url.pathname}${url.search}${url.hash}`;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'page_view',
      page_location: url.href,
      page_path: path,
      page_title: document.title
    });
  });
</script>

<svelte:head>
  <title>Voto a voto — como votaram deputados e senadores</title>
  <meta
    name="description"
    content="Votações nominais da Câmara dos Deputados e do Senado Federal: o resultado de cada votação e como cada parlamentar votou."
  />
</svelte:head>

<slot />
