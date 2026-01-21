<script>
	import { onMount } from 'svelte';

	let bannerEl;
	let visible = false;

	onMount(() => {
		try {
			if (typeof window === 'undefined') return;
			window.adsbygoogle = window.adsbygoogle || [];
			window.adsbygoogle.push({});
			const checkFilled = () => {
				const status = bannerEl?.getAttribute('data-ad-status');
				visible = status === 'filled';
			};
			const timer = window.setTimeout(checkFilled, 1200);
			const timer2 = window.setTimeout(checkFilled, 3000);
			return () => {
				window.clearTimeout(timer);
				window.clearTimeout(timer2);
			};
		} catch (error) {
			console.warn('AdSense load failed', error);
		}
	});
</script>

<div class={`ad-banner ${visible ? 'ad-banner--visible' : 'ad-banner--hidden'}`}>
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
		margin: 0 0 calc(var(--grid) * 1.5);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ad-banner--hidden {
		display: none;
	}

	.ad-banner :global(ins.adsbygoogle) {
		width: 100%;
	}
</style>
