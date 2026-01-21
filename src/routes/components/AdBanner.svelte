<script>
	import { onMount } from 'svelte';

	let bannerEl;

	onMount(() => {
		try {
			if (typeof window === 'undefined') return;
			window.adsbygoogle = window.adsbygoogle || [];
			window.adsbygoogle.push({});
		} catch (error) {
			console.warn('AdSense load failed', error);
		}
	});
</script>

<div class="ad-banner">
	<ins
		bind:this={bannerEl}
		class="adsbygoogle"
		style="display:block"
		data-ad-client="ca-pub-8146127802460297"
		data-ad-slot="6263217403"
		data-ad-format="auto"
		data-full-width-responsive="true"
	></ins>
</div>

<style>
	.ad-banner {
		width: 100%;
		min-height: 90px;
		margin: calc(var(--grid) * 1.5) 0;
		padding: calc(var(--grid) * 1) 0;
		border-radius: var(--radius-m);
		background: var(--color-surface);
		box-shadow: var(--shadow-1);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ad-banner :global(ins.adsbygoogle) {
		width: 100%;
	}
</style>
