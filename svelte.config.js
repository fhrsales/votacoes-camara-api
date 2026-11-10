import adapter from '@sveltejs/adapter-static';
import { readFileSync } from 'fs';

// One page per deputy and per senator is rendered at build time, from the profiles built by
// scripts/build-perfis.mjs (CASA=senado for the Senado)
function paginas(arquivo, rota) {
	try {
		const indice = JSON.parse(readFileSync(arquivo, 'utf8'));
		return indice.deputados.map((d) => `/${rota}/${d.slug}`);
	} catch {
		return [];
	}
}
const paginasDeputados = paginas('static/data/perfis/index.json', 'deputado');
const paginasSenadores = paginas('static/data/senado/perfis/index.json', 'senador');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: '404.html'
		}),
		// The page CSS (about 50 KB raw, a few KB gzipped) goes inline: six stylesheets were
		// blocking the first paint on slow connections (Lighthouse, 10/11/2026)
		inlineStyleThreshold: 40000,
		paths: {
			base: process.env.BASE_PATH ?? ''
		},
		prerender: {
			entries: ['*', '/deputados', '/senadores', '/governabilidade', ...paginasDeputados, ...paginasSenadores],
			// #votacao and similar anchors exist only once the data has loaded in the browser
			handleMissingId: 'ignore'
		}
	}
};

export default config;
