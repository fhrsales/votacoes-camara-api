<script>
	import { createEventDispatcher } from 'svelte';
	import { countUp, portal } from '$lib/motion.js';
	import { COR, TIPOS, contar } from '$lib/votos.js';

	/** Every seat: registered votes plus absentees, one entry per deputy. */
	export let votos = [];
	export let chave = '';
	export let filtroVoto = '';
	export let filtroEstado = '';
	export let filtroPartido = '';
	export let filtroNome = '';
	/** Ids of women deputies, for the silhouettes. */
	export let mulheres = new Set();

	const dispatch = createEventDispatcher();
	const CADEIRAS = 513;
	// A floor plane seen in perspective. Each vote is a loose crowd standing on it, side by
	// side; near people are big and low, far ones small and high.
	const LARGURA = 1000;
	const CENTRO_X = 500;
	const CHAO_Y = 560; // where the nearest feet stand
	const HORIZONTE_Y = 90; // where the plane would vanish
	const MEIA_LARGURA = 470; // half the floor width at the front, in drawing units
	const PERTO = 1.0; // distance from the eye to the front of the crowd
	const FUNDO = 1.35; // how fast things shrink with depth
	const OURO = Math.PI * (3 - Math.sqrt(5)); // golden angle, for an even organic spread
	const FIG_ALTURA = 74; // height of a person at the front
	const VARIANTES_H = ['pf-h1', 'pf-h2'];
	const VARIANTES_M = ['pf-m1', 'pf-m2'];

	// Stable pseudo-random numbers, so the crowd does not reshuffle on every render
	function ruido(i, sal) {
		const x = Math.sin(i * 127.1 + sal * 311.7) * 43758.5453;
		return x - Math.floor(x);
	}

	let wrapEl;
	let hover = null;
	let tip = { x: 0, y: 0 };

	$: ordenados = (() => {
		const registrados = votos.filter((v) => v.tipoVoto !== 'Ausentes');
		const vagas = Math.max(0, CADEIRAS - registrados.length);
		const ausentes = votos.filter((v) => v.tipoVoto === 'Ausentes').slice(0, vagas);
		return [...registrados, ...ausentes].sort((a, b) => {
			const t = TIPOS.indexOf(a.tipoVoto) - TIPOS.indexOf(b.tipoVoto);
			if (t) return t;
			return (a.deputado_?.siglaPartido || '').localeCompare(b.deputado_?.siglaPartido || '');
		});
	})();

	// Lay the groups side by side on the floor and spread each one like a sunflower head:
	// even density, no rows, no arc. Inside a group people are sorted by party, so parties
	// stand together too.
	function montar(lista) {
		const grupos = TIPOS.map((tipo) => ({
			tipo,
			pessoas: lista.filter((v) => v.tipoVoto === tipo)
		})).filter((g) => g.pessoas.length);
		const folga = 0.1; // gap between groups, in floor units
		const largura = 2; // floor width, x from -1 to 1
		const SX = 1.35; // groups are wider than deep: a crowd spread along the floor
		const SZ = 0.6;
		// Group radius grows with the square root of its size; solve for the spacing
		const somaRaiz = grupos.reduce((a, g) => a + Math.sqrt(g.pessoas.length), 0);
		const c = (largura - folga * (grupos.length - 1)) / (2 * SX * somaRaiz);
		let cursor = -1;
		const saida = [];
		const rotulos = [];
		for (const g of grupos) {
			const raio = c * Math.sqrt(g.pessoas.length);
			const cx = cursor + raio * SX;
			const cz = raio * SZ + 0.03;
			cursor += raio * SX * 2 + folga;
			g.pessoas.forEach((voto, k) => {
				const id = Number(voto.deputado_?.id) || k;
				const rr = c * Math.sqrt(k + 0.5) * (0.96 + ruido(id, 4) * 0.08);
				const th = k * OURO + ruido(id, 5) * 0.35;
				saida.push({
					voto,
					x: cx + rr * Math.cos(th) * SX,
					z: Math.max(0, cz + rr * Math.sin(th) * SZ),
					grupo: g.tipo
				});
			});
			rotulos.push({ tipo: g.tipo, n: g.pessoas.length, x: cx });
		}
		return { saida, rotulos };
	}

	// True perspective on the floor plane: size and height both follow 1 / distance
	function projetar(x, z) {
		const escala = PERTO / (PERTO + z * FUNDO);
		return {
			x: CENTRO_X + x * MEIA_LARGURA * escala,
			y: HORIZONTE_Y + (CHAO_Y - HORIZONTE_Y) * escala,
			escala
		};
	}

	$: montagem = montar(ordenados);
	$: figuras = montagem.saida
		.map((p) => {
			const { voto } = p;
			const q = projetar(p.x, p.z);
			const mulher = mulheres.has(voto.deputado_?.id);
			const id = Number(voto.deputado_?.id) || 0;
			const lista = mulher ? VARIANTES_M : VARIANTES_H;
			const altura = FIG_ALTURA * q.escala * (0.94 + ruido(id, 3) * 0.1);
			// Everyone walks in from the front edge, spread along it, then takes their place
			const entradaX = CENTRO_X + (ruido(id, 6) - 0.5) * LARGURA * 1.1;
			const entradaY = CHAO_Y + 90 + ruido(id, 7) * 60;
			const entradaEscala = (FIG_ALTURA * 1.15) / 100;
			return {
				voto,
				...q,
				z: p.z,
				altura,
				variante: lista[id % lista.length],
				para: `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px) scale(${(altura / 100).toFixed(4)})`,
				de: `translate(${entradaX.toFixed(1)}px, ${entradaY.toFixed(1)}px) scale(${entradaEscala.toFixed(4)})`,
				atraso: Math.round(ruido(id, 8) * 900 + (1 - q.escala) * 500)
			};
		})
		// Paint from the back to the front so nearer people overlap those behind
		.sort((a, b) => b.z - a.z);
	$: rotulos = montagem.rotulos.map((r) => ({ ...r, ...projetar(r.x, 0) }));
	$: c = contar(ordenados);
	$: resultado = c.Sim >= c.Não ? 'Sim' : 'Não';
	$: topo = Math.min(...figuras.map((f) => f.y - f.altura), CHAO_Y) - 10;
	const RODAPE = 46;

	function apagada(v, filtroVoto, filtroEstado, filtroPartido, filtroNome) {
		if (filtroVoto && v.tipoVoto !== filtroVoto) return true;
		if (filtroEstado && v.deputado_?.siglaUf !== filtroEstado) return true;
		if (filtroPartido && v.deputado_?.siglaPartido !== filtroPartido) return true;
		if (filtroNome && v.deputado_?.nome !== filtroNome) return true;
		return false;
	}

	function mostrar(event, f) {
		hover = f.voto;
		mover(event);
	}

	// The tooltip lives on <body> with fixed position, above the sticky bar and everything else.
	// Near the top of the window it opens below the cursor instead.
	function mover(event) {
		const x = event.clientX ?? window.innerWidth / 2;
		const y = event.clientY ?? 0;
		tip = {
			x: Math.min(Math.max(x, 140), window.innerWidth - 140),
			y,
			baixo: y < 230
		};
	}
</script>

<figure class="pf">
	<div class="pf-stage" bind:this={wrapEl} on:mouseleave={() => (hover = null)}>
		{#key chave}
			<svg
				viewBox={`0 ${topo} ${LARGURA} ${CHAO_Y + RODAPE - topo}`}
				role="img"
				aria-label={`Plenário: ${c.Sim} sim, ${c.Não} não, ${c.Abstenção} abstenções, ${c.Obstrução} obstruções, ${c.Ausentes} ausentes`}
			>
				<defs>
					<!-- Standing politicians, 40 x 100, feet at the bottom centre. Drawn for this page. -->
					<g id="pf-h1">
						<path d="M20 0.9C22.9 0.9 24.5 3.3 24.4 6.5C24.3 9.8 22.6 12.4 20 12.4C17.4 12.4 15.7 9.8 15.6 6.5C15.5 3.3 17.1 0.9 20 0.9Z" />
						<path d="M18.1 11H21.9L22.2 19H17.8Z" />
						<path d="M17.8 14.6L20 18.6L22.2 14.6C25 15.2 28.6 15.6 30.6 16.8C31.8 17.6 32.2 19 32 21L30.6 32C30 36 28.2 39 27.6 42L27.8 54.6H12.2L12.4 42C11.8 39 10 36 9.4 32L8 21C7.8 19 8.2 17.6 9.4 16.8C11.4 15.6 15 15.2 17.8 14.6Z" />
						<path d="M8.3 17.3C6.6 18.1 6 19.9 6.1 22.5L6.6 37L6.9 50.2C6.9 52.6 7.4 54.8 8.6 55.8C9.8 56.6 10.8 55.6 10.6 53.6L10.5 50L10.6 37L11 26Z" />
						<path d="M 31.7 17.3 C 33.4 18.1 34 19.9 33.9 22.5 L 33.4 37 L 33.1 50.2 C 33.1 52.6 32.6 54.8 31.4 55.8 C 30.2 56.6 29.2 55.6 29.4 53.6 L 29.5 50 L 29.4 37 L 29 26Z" />
						<path d="M12.4 54.2H19.6L19.3 58.6L18.5 74.4L18.1 95.4L18.5 97.4C18.7 98.9 17.7 99.6 15.4 99.6H12.2C11.4 99.6 11.3 98.8 12.1 98.2L14.5 96.4L14.3 74.4L12.7 60Z" />
						<path d="M 27.6 54.2 H 20.4 L 20.7 58.6 L 21.5 74.4 L 21.9 95.4 L 21.5 97.4 C 21.3 98.9 22.3 99.6 24.6 99.6 H 27.8 C 28.6 99.6 28.7 98.8 27.9 98.2 L 25.5 96.4 L 25.7 74.4 L 27.3 60Z" />
					</g>
					<g id="pf-h2">
						<path d="M20 0.9C22.9 0.9 24.5 3.3 24.4 6.5C24.3 9.8 22.6 12.4 20 12.4C17.4 12.4 15.7 9.8 15.6 6.5C15.5 3.3 17.1 0.9 20 0.9Z" />
						<path d="M18.1 11H21.9L22.2 19H17.8Z" />
						<path d="M17.8 14.6L20 18.6L22.2 14.6C25 15.2 28.6 15.6 30.6 16.8C31.8 17.6 32.2 19 32 21L30.6 32C30 36 28.2 39 27.6 42L27.8 54.6H12.2L12.4 42C11.8 39 10 36 9.4 32L8 21C7.8 19 8.2 17.6 9.4 16.8C11.4 15.6 15 15.2 17.8 14.6Z" />
						<path d="M8.3 17.3C6.6 18.1 5.8 19.9 5.6 22.5L4.9 37L4.5 50.2C4.4 52.6 4.9 54.8 6.1 55.8C7.3 56.6 8.3 55.6 8.2 53.6L8.4 50L9.5 37L11 26Z" />
						<path d="M 31.7 17.3 C 33.4 18.1 34.2 19.9 34.4 22.5 L 35.1 37 L 35.5 50.2 C 35.6 52.6 35.1 54.8 33.9 55.8 C 32.7 56.6 31.7 55.6 31.8 53.6 L 31.6 50 L 30.5 37 L 29 26Z" />
						<path d="M12.4 54.2H19.6L19 58.6L17.3 74.4L16.2 95.4L16.6 97.4C16.8 98.9 15.8 99.6 13.5 99.6H10.3C9.5 99.6 9.4 98.8 10.2 98.2L12.6 96.4L13.1 74.4L12.7 60Z" />
						<path d="M 27.6 54.2 H 20.4 L 21 58.6 L 22.7 74.4 L 23.8 95.4 L 23.4 97.4 C 23.2 98.9 24.2 99.6 26.5 99.6 H 29.7 C 30.5 99.6 30.6 98.8 29.8 98.2 L 27.4 96.4 L 26.9 74.4 L 27.3 60Z" />
					</g>
					<g id="pf-m1">
						<path d="M20 0.8C24.4 0.8 25.9 4 25.5 8.2L25.9 15.2C24 16.3 22 16.5 20 16.5C18 16.5 16 16.3 14.1 15.2L14.5 8.2C14.1 4 15.6 0.8 20 0.8Z" />
						<path d="M18.4 12H21.6L21.8 19.2H18.2Z" />
						<path d="M17.8 15.8L20 18.8L22.2 15.8C24.4 16.3 27 16.6 28.5 17.5C29.6 18.2 30 19.6 29.8 21.6L28.8 31C28.3 35 26.6 38 26.3 41C26.7 44.6 27.8 47.6 27.9 51L27.3 72.4H12.7L12.1 51C12.2 47.6 13.3 44.6 13.7 41C13.4 38 11.7 35 11.2 31L10.2 21.6C10 19.6 10.4 18.2 11.5 17.5C13 16.6 15.6 16.3 17.8 15.8Z" />
						<path d="M10.6 17.8C9.2 18.6 8.7 20.2 8.8 22.6L9.2 36L9.6 49C9.6 51.2 10.1 53 11.1 53.8C12.1 54.4 12.9 53.6 12.8 51.8L12.7 48L12.9 36L13.1 26Z" />
						<path d="M 29.4 17.8 C 30.8 18.6 31.3 20.2 31.2 22.6 L 30.8 36 L 30.4 49 C 30.4 51.2 29.9 53 28.9 53.8 C 27.9 54.4 27.1 53.6 27.2 51.8 L 27.3 48 L 27.1 36 L 26.9 26Z" />
						<path d="M14.6 71.6H18.6L18.1 80L17.7 94.2L18.5 97.4C18.7 98.7 17.9 99.5 16.5 99.5H15.5C14.7 99.5 14.5 98.9 15 98.3L15.5 94.2L14.9 80Z" />
						<path d="M 25.4 71.6 H 21.4 L 21.9 80 L 22.3 94.2 L 21.5 97.4 C 21.3 98.7 22.1 99.5 23.5 99.5 H 24.5 C 25.3 99.5 25.5 98.9 25 98.3 L 24.5 94.2 L 25.1 80Z" />
					</g>
					<g id="pf-m2">
						<path d="M20 0.6A2.6 2.6 0 1 1 19.99 0.6Z" />
						<path d="M20 2.2C22.7 2.2 24.2 4.4 24.1 7.4C24 10.4 22.4 12.8 20 12.8C17.6 12.8 16 10.4 15.9 7.4C15.8 4.4 17.3 2.2 20 2.2Z" />
						<path d="M18.3 11.4H21.7L21.9 19H18.1Z" />
						<path d="M17.9 15.2L20 18.6L22.1 15.2C24.6 15.7 27.4 16 29 17C30.1 17.7 30.5 19.1 30.3 21.1L29.2 31C28.6 35 26.9 38 26.6 41C27 45 27.6 49 27.6 54.2H12.4C12.4 49 13 45 13.4 41C13.1 38 11.4 35 10.8 31L9.7 21.1C9.5 19.1 9.9 17.7 11 17C12.6 16 15.4 15.7 17.9 15.2Z" />
						<path d="M10.4 17.4C9 18.2 8.5 19.8 8.6 22.2L9 36L9.4 49.4C9.4 51.6 9.9 53.4 10.9 54.2C11.9 54.8 12.7 54 12.6 52.2L12.5 48.4L12.7 36L12.9 26Z" />
						<path d="M 29.6 17.4 C 31 18.2 31.5 19.8 31.4 22.2 L 31 36 L 30.6 49.4 C 30.6 51.6 30.1 53.4 29.1 54.2 C 28.1 54.8 27.3 54 27.4 52.2 L 27.5 48.4 L 27.3 36 L 27.1 26Z" />
						<path d="M12.8 53.8H19.6L19.2 60L18.3 75L18 95.8L18.6 97.6C18.8 98.8 17.9 99.5 16.4 99.5H14.6C13.8 99.5 13.6 98.9 14.2 98.4L15.2 95.8L14.8 75L13.1 60Z" />
						<path d="M 27.2 53.8 H 20.4 L 20.8 60 L 21.7 75 L 22 95.8 L 21.4 97.6 C 21.2 98.8 22.1 99.5 23.6 99.5 H 25.4 C 26.2 99.5 26.4 98.9 25.8 98.4 L 24.8 95.8 L 25.2 75 L 26.9 60Z" />
					</g>
				</defs>

				{#each figuras as f (f.voto)}
					<g class="pessoa" style={`transform:${f.para};--de:${f.de};--d:${f.atraso}ms`}>
						<ellipse
							class="sombra"
							class:sombra--off={apagada(f.voto, filtroVoto, filtroEstado, filtroPartido, filtroNome)}
							cx="0"
							cy="0"
							rx="21"
							ry="4.2"
						/>
						<use
							href={`#${f.variante}`}
							x="-20"
							y="-99.6"
							class="halo"
							class:halo--off={apagada(f.voto, filtroVoto, filtroEstado, filtroPartido, filtroNome)}
							aria-hidden="true"
						/>
						<use
							href={`#${f.variante}`}
							x="-20"
							y="-99.6"
							class={`fig fig--${f.voto.tipoVoto === 'Não' ? 'nao' : f.voto.tipoVoto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}`}
							class:fig--off={apagada(f.voto, filtroVoto, filtroEstado, filtroPartido, filtroNome)}
							class:fig--on={hover === f.voto}
							on:mouseenter={(e) => mostrar(e, f)}
							on:mousemove={mover}
							on:click={() => dispatch('deputado', f.voto.deputado_?.nome)}
							on:keydown={(e) => e.key === 'Enter' && dispatch('deputado', f.voto.deputado_?.nome)}
							role="button"
							tabindex="-1"
							aria-label={`${f.voto.deputado_?.nome}: ${f.voto.tipoVoto}`}
						/>
					</g>
				{/each}

				{#each rotulos as r (r.tipo)}
					<text class="rotulo" x={r.x.toFixed(1)} y={CHAO_Y + 36}>
						<tspan class="rotulo-n">{r.n}</tspan>
						<tspan dx="6">{r.tipo.toLowerCase()}</tspan>
					</text>
				{/each}
			</svg>
		{/key}

		{#if hover}
			<div class="pf-tip" class:pf-tip--baixo={tip.baixo} style={`left:${tip.x}px;top:${tip.y}px`} use:portal>
				<img src={hover.deputado_?.urlFoto} alt="" width="52" height="52" loading="lazy" />
				<div>
					<strong>{hover.deputado_?.nome}</strong>
					<span>{hover.deputado_?.siglaPartido} · {hover.deputado_?.siglaUf}</span>
					<em style={`--c:${COR[hover.tipoVoto]}`}>{hover.tipoVoto}</em>
				</div>
			</div>
		{/if}
	</div>

	<div class="pf-placar">
		<span class="score score--sim"><b use:countUp={c.Sim}>0</b><small>sim</small></span>
		<span class="score-x">×</span>
		<span class="score score--nao"><b use:countUp={c.Não}>0</b><small>não</small></span>
		{#if c.Sim + c.Não > 0}
			<p>
				Venceu o <strong>{resultado.toLowerCase()}</strong>
				por {Math.abs(c.Sim - c.Não).toLocaleString('pt-BR')} votos
			</p>
		{/if}
	</div>

	<figcaption class="pf-legend">
		{#each TIPOS as tipo}
			<button
				type="button"
				class="legend-item"
				class:legend-item--off={filtroVoto && filtroVoto !== tipo}
				on:click={() => dispatch('tipo', tipo)}
			>
				<svg viewBox="0 0 40 100" aria-hidden="true">
					<use
						href="#pf-h1"
						class={`fig fig--${tipo === 'Não' ? 'nao' : tipo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}`}
					/>
				</svg>
				{tipo}
				<b use:countUp={c[tipo]}>0</b>
			</button>
		{/each}
	</figcaption>
</figure>

<style>
	.pf {
		margin: 0;
	}

	.pf-stage {
		position: relative;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.pf-piso {
		fill: var(--color-track);
		opacity: 0.6;
	}

	.pessoa {
		animation: chegada 1500ms cubic-bezier(0.25, 0.7, 0.2, 1) backwards;
		animation-delay: var(--d);
	}

	/* They come in from the front edge and walk to their group */
	@keyframes chegada {
		from {
			transform: var(--de);
			opacity: 0;
		}
		12% {
			opacity: 1;
		}
	}

	.fig {
		cursor: pointer;
		transition: opacity 360ms var(--ease), fill 180ms var(--ease);
	}

	.sombra {
		fill: var(--vote-sim);
		opacity: 0.08;
		transition: opacity 360ms var(--ease);
	}

	.sombra--off {
		opacity: 0.02;
	}

	/* A paper-coloured halo behind each person separates overlapping people
	   without drawing seams inside a figure */
	.halo {
		fill: var(--color-light);
		stroke: var(--color-light);
		stroke-width: 5;
		stroke-linejoin: round;
		pointer-events: none;
		transition: opacity 360ms var(--ease);
	}

	.rotulo {
		text-anchor: middle;
		font-family: var(--font-primary);
		font-size: 17px;
		fill: var(--color-text-muted);
	}

	.rotulo-n {
		font-family: var(--font-display);
		font-size: 24px;
		fill: var(--color-dark);
	}

	.halo--off {
		opacity: 0.4;
	}

	.fig--sim {
		fill: var(--vote-sim);
	}

	.fig--nao {
		fill: var(--vote-nao);
	}

	.fig--abstencao {
		fill: var(--vote-abstencao);
	}

	.pf-stage .fig--obstrucao,
	.fig--obstrucao {
		fill: var(--color-light);
		stroke: var(--vote-sim);
		stroke-width: 2.6;
		paint-order: normal;
	}

	.pf-stage .fig--ausentes,
	.fig--ausentes {
		fill: var(--color-light);
		stroke: var(--vote-ausentes-traco);
		stroke-width: 2.6;
		paint-order: normal;
	}

	/* Hover only recolours: the person stays exactly where they are */
	.fig:hover,
	.fig--on {
		fill: var(--accent-amber);
	}

	.fig--off {
		opacity: 0.1;
	}

	.pf-tip {
		position: fixed;
		transform: translate(-50%, calc(-100% - 22px));
		display: flex;
		gap: calc(var(--grid) * 1.6);
		align-items: center;
		padding: calc(var(--grid) * 1.4) calc(var(--grid) * 2.4) calc(var(--grid) * 1.4)
			calc(var(--grid) * 1.4);
		background: var(--color-dark);
		color: var(--color-light);
		border-radius: 16px;
		box-shadow: var(--shadow-2);
		pointer-events: none;
		white-space: nowrap;
		z-index: 1000;
		animation: tip-in 180ms var(--ease);
	}

	.pf-tip--baixo {
		transform: translate(-50%, 26px);
		animation: none;
	}

	.pf-tip--baixo::after {
		top: auto;
		bottom: 100%;
		border-top-color: transparent;
		border-bottom-color: var(--color-dark);
	}

	.pf-tip::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 100%;
		transform: translateX(-50%);
		border: 8px solid transparent;
		border-top-color: var(--color-dark);
	}

	.pf-tip img {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		object-fit: cover;
		background: color-mix(in srgb, var(--color-light) 20%, transparent);
	}

	.pf-tip div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: var(--t-small);
		line-height: 1.3;
	}

	.pf-tip strong {
		font-size: var(--t-caption);
	}

	.pf-tip span {
		opacity: 0.7;
	}

	.pf-tip em {
		font-style: normal;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.pf-tip em::before {
		content: '';
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--c);
		box-shadow: 0 0 0 1.5px var(--color-light);
	}

	@keyframes tip-in {
		from {
			opacity: 0;
			transform: translate(-50%, calc(-100% - 12px));
		}
	}

	.pf-placar {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: center;
		gap: 0 calc(var(--grid) * 1.6);
		margin-top: calc(var(--grid) * 2);
		font-family: var(--font-display);
	}

	.pf-placar p {
		flex-basis: 100%;
		text-align: center;
		margin: calc(var(--grid) * 1) 0 0;
		font-family: var(--font-primary);
		font-size: calc(var(--grid) * 1.9);
		color: var(--color-text-muted);
	}

	.score {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
	}

	.score b {
		font-weight: 500;
		font-size: clamp(calc(var(--grid) * 4), 6vw, calc(var(--grid) * 6.5));
		line-height: 1;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}

	.score small {
		font-family: var(--font-primary);
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.score--sim {
		color: var(--vote-sim);
	}

	.score--nao {
		color: var(--vote-nao);
		flex-direction: row-reverse;
	}

	.score-x {
		font-size: calc(var(--grid) * 3);
		opacity: 0.35;
	}

	.pf-legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: calc(var(--grid) * 0.6) calc(var(--grid) * 2.4);
		margin-top: calc(var(--grid) * 3);
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--grid) * 0.7);
		border: 0;
		background: none;
		padding: calc(var(--grid) * 0.4) 0;
		font: inherit;
		font-size: var(--t-caption);
		color: var(--color-dark);
		cursor: pointer;
		transition: opacity 180ms var(--ease);
	}

	.legend-item svg {
		width: 10px;
		height: 24px;
		overflow: visible;
	}

	.legend-item .fig {
		animation: none;
	}

	.legend-item b {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.legend-item--off {
		opacity: 0.35;
	}
	@media (max-width: 600px) {
		.rotulo {
			display: none;
		}
	}
</style>
