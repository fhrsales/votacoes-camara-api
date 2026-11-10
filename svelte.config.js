import adapter from '@sveltejs/adapter-static';
import { readFileSync } from 'fs';

// One page per deputy is rendered at build time, from the profiles built by scripts/build-perfis.mjs
let paginasDeputados = [];
try {
	const indice = JSON.parse(readFileSync('static/data/perfis/index.json', 'utf8'));
	paginasDeputados = indice.deputados.map((d) => `/deputado/${d.slug}`);
} catch {
	paginasDeputados = [];
}

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
			entries: ['*', '/deputados', ...paginasDeputados],
			// #votacao and similar anchors exist only once the data has loaded in the browser
			handleMissingId: 'ignore'
		}
	}
};

export default config;
