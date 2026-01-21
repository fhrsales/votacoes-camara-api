<script>
	import { onMount } from 'svelte';

	let bannerEl;
	let visible = false;

	onMount(() => {
		try {
			if (typeof window === 'undefined') return;
			window.adsbygoogle = window.adsbygoogle || [];
			let attempts = 0;
			const tryPush = () => {
				attempts += 1;
				if (bannerEl && bannerEl.offsetWidth > 0) {
					window.adsbygoogle.push({});
					return;
				}
				if (attempts < 6) {
					window.setTimeout(tryPush, 200);
				}
			};
			tryPush();
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
		transition: opacity 180ms ease;
	}

	.ad-banner--hidden {
		opacity: 0;
		max-height: 0;
		margin: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.ad-banner :global(ins.adsbygoogle) {
		width: 100%;
	}
</style>
