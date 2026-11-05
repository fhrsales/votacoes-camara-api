export const TIPOS = ['Sim', 'Abstenção', 'Obstrução', 'Ausentes', 'Não'];

export const COR = {
	Sim: 'var(--vote-sim)',
	Não: 'var(--vote-nao)',
	Abstenção: 'var(--vote-abstencao)',
	Obstrução: 'var(--vote-obstrucao)',
	Ausentes: 'var(--vote-ausentes)'
};

export function contar(lista) {
	const c = { Sim: 0, Não: 0, Abstenção: 0, Obstrução: 0, Ausentes: 0, total: 0 };
	for (const v of lista) {
		if (c[v?.tipoVoto] === undefined) continue;
		c[v.tipoVoto] += 1;
		c.total += 1;
	}
	return c;
}

export function agruparPor(lista, getter) {
	const mapa = new Map();
	for (const v of lista) {
		const chave = getter(v);
		if (!chave) continue;
		if (!mapa.has(chave)) mapa.set(chave, []);
		mapa.get(chave).push(v);
	}
	return Array.from(mapa, ([chave, itens]) => ({ chave, ...contar(itens) }));
}

/** Seats per state in the Câmara (LC 78/1993), 513 in all. */
export const CADEIRAS_UF = {
	SP: 70, MG: 53, RJ: 46, BA: 39, RS: 31, PR: 30, PE: 25, CE: 22, MA: 18, GO: 17, PA: 17,
	SC: 16, PB: 12, ES: 10, PI: 10, AL: 9, RN: 8, AM: 8, MT: 8, DF: 8, MS: 8, AC: 8, AP: 8,
	RO: 8, RR: 8, SE: 8, TO: 8
};
