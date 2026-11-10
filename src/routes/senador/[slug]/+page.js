import { error } from '@sveltejs/kit';
import { base } from '$app/paths';

// Rendered at build time for every senator listed in static/data/senado/perfis/index.json
export const prerender = true;

export async function load({ params, fetch }) {
	const id = params.slug.split('-').pop();
	const res = await fetch(`${base}/data/senado/perfis/${id}.json`);
	if (!res.ok) throw error(404, 'Perfil não encontrado');
	return { perfil: await res.json() };
}
