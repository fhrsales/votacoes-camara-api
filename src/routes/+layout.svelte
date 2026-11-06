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



<slot />
