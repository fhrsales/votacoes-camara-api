import { base } from '$app/paths';

export const prerender = true;

export async function load({ fetch }) {
	const res = await fetch(`${base}/data/senado/governabilidade/index.json`);
	return { indice: res.ok ? await res.json() : { governos: [], meses: [] } };
}
