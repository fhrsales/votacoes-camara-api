import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: '404.html'
		}),
		paths: {
			base: process.env.BASE_PATH ?? ''
		},
		prerender: {
			entries: ['*'],
			// #votacao and similar anchors exist only once the data has loaded in the browser
			handleMissingId: 'ignore'
		}
	}
};

export default config;
