<script>
	import { hierarchy, pack } from 'd3';
	import { manterNaTela, portal } from '$lib/motion.js';

	export let title = '';
	export let items = [];
	export let size = 400;
	export let padding = 1;
	export let layoutMode = 'pack';
	export let onToggle = null;

	// Same order as everywhere else: sim on the left, não on the right
	const tipos = ['Sim', 'Abstenção', 'Obstrução', 'Ausentes', 'Não'];
	const cores = {
		Sim: 'var(--vote-sim)',
		'Não': 'var(--vote-nao)',
		Abstenção: 'var(--vote-abstencao)',
		Obstrução: 'var(--vote-obstrucao)',
		Ausentes: 'var(--vote-ausentes)'
	};

	let tooltip = {
		visible: false,
		label: '',
		value: 0,
		tipo: '',
		x: 0,
		y: 0
	};
	let hoveredKey = '';

	function computeLayout(rawItems, mode) {
		if (!rawItems?.length) return [];
		if (mode === 'stack') {
			return computeStacked(rawItems);
		}
		const root = hierarchy({ children: rawItems }).sum((d) => d.value);
		const packed = pack().size([size, size]).padding(padding)(root);
		return packed.leaves().map((node) => ({
			...node.data,
			x: node.x,
			y: node.y,
			r: node.r
		}));
	}

	function computeStacked(rawItems) {
		const byTipo = new Map();
		for (const item of rawItems) {
			const tipo = item.tipo || 'Outros';
			if (!byTipo.has(tipo)) byTipo.set(tipo, []);
			byTipo.get(tipo).push(item);
		}

		const maxValue = Math.max(...rawItems.map((d) => d.value));
		const minValue = Math.min(...rawItems.map((d) => d.value));
		const minRadius = 10;
		const maxRadius = 60;
		const stackPadding = 0.2;
		const scale = (value) => {
			if (maxValue === minValue) return (minRadius + maxRadius) / 2;
			const t = (Math.sqrt(value) - Math.sqrt(minValue)) / (Math.sqrt(maxValue) - Math.sqrt(minValue));
			return minRadius + t * (maxRadius - minRadius);
		};

		const columns = tipos.filter((tipo) => byTipo.has(tipo));
		const layout = [];
		const overlapFactor = 0.3;
		const overlapX = 1.6;
		const margin = 20;

		const columnMeta = columns.map((tipo) => {
			const colItems = byTipo.get(tipo).slice().sort((a, b) => b.value - a.value);
			const maxR = colItems.reduce((acc, item) => Math.max(acc, scale(item.value)), 0);
			return { tipo, colItems, maxR };
		});

		const centers = [];
		let currentX = columnMeta[0]?.maxR || 0;
		centers.push(currentX);
		for (let i = 1; i < columnMeta.length; i += 1) {
			const prev = columnMeta[i - 1];
			const cur = columnMeta[i];
			currentX += (prev.maxR + cur.maxR) * overlapX;
			centers.push(currentX);
		}

		const minX = (centers[0] || 0) - (columnMeta[0]?.maxR || 0);
		const maxX =
			(centers[centers.length - 1] || 0) + (columnMeta[columnMeta.length - 1]?.maxR || 0);
		const spanX = maxX - minX || 1;
		const scaleX = spanX > size - margin * 2 ? (size - margin * 2) / spanX : 1;
		const offsetX = (size - spanX * scaleX) / 2 - minX * scaleX;

		columnMeta.forEach((meta, index) => {
			const { tipo, colItems } = meta;
			let y = 0;
			const x = centers[index] * scaleX + offsetX;
			let prevR = 0;
			for (let i = 0; i < colItems.length; i += 1) {
				const item = colItems[i];
				const r = scale(item.value);
				if (i === 0) {
					y = size - r - margin;
				} else {
					y -= (prevR + r) * overlapFactor;
				}
				layout.push({ ...item, tipo, x, y, r });
				prevR = r;
			}

			const colNodes = layout.filter((n) => n.tipo === tipo);
			const minTop = Math.min(...colNodes.map((n) => n.y - n.r));
			const maxBottom = Math.max(...colNodes.map((n) => n.y + n.r));
			const span = maxBottom - minTop;
			if (span > size - margin * 2) {
				const scaleY = (size - margin * 2) / span;
				colNodes.forEach((n) => {
					n.y = (n.y - minTop) * scaleY + margin;
				});
			}
		});

		return layout;
	}

	$: layout = computeLayout(items, layoutMode);
	$: layoutRender = layoutMode === 'stack' ? [...layout].sort((a, b) => b.r - a.r) : layout;

	// A tap fires mouseenter and then focus. Focus carries no pointer position, so it used to
	// overwrite the tap position with NaN and the tooltip landed off screen. Fall back to the
	// bubble's own centre when the event has no coordinates.
	function ponto(event) {
		if (typeof event.clientX === 'number' && (event.clientX || event.clientY)) {
			return { x: event.clientX, y: event.clientY };
		}
		const r = event.currentTarget.getBoundingClientRect();
		return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
	}

	function posicao(event) {
		const { x, y } = ponto(event);
		return {
			x: Math.min(Math.max(x, 120), window.innerWidth - 120),
			y,
			baixo: y < 220
		};
	}

	function showTooltip(event, item) {
		hoveredKey = `${item.label}-${item.tipo}`;
		tooltip = {
			visible: true,
			label: item.label,
			value: item.value,
			tipo: item.tipo,
			total: items.filter((d) => d.label === item.label).reduce((a, d) => a + d.value, 0),
			...posicao(event)
		};
	}

	function moveTooltip(event) {
		if (!tooltip.visible) return;
		tooltip = { ...tooltip, ...posicao(event) };
	}

	function hideTooltip() {
		tooltip = { ...tooltip, visible: false };
		hoveredKey = '';
	}

	// On a phone the tooltip is fixed to the screen, so close it once the page scrolls
	// or the visitor taps somewhere else
	function fecharSeFora(event) {
		if (tooltip.visible && !event.target.closest?.('.bolha')) hideTooltip();
	}

	function fecharAoRolar() {
		if (tooltip.visible) hideTooltip();
	}
</script>

<svelte:window on:scroll|passive={fecharAoRolar} on:pointerdown={fecharSeFora} />

	<section class="bubble-chart">
		{#if title}
			<h3>{title}</h3>
		{/if}
		<div class="uva-container-bubble-chart">
			<div
				class="uva-tooltip dica"
				class:uva-tooltip--baixo={tooltip.baixo}
				class:dica--baixo={tooltip.baixo}
				use:portal
				use:manterNaTela={tooltip}
				style={`opacity: ${tooltip.visible ? 1 : 0}; left: ${tooltip.x}px; top: ${tooltip.y}px;`}
			>
				<span class="dica-rotulo">{tooltip.label}</span>
				<span class="dica-valor">{tooltip.value}<small>{tooltip.tipo === 'Ausentes' ? 'ausentes' : `votaram ${String(tooltip.tipo).toLowerCase()}`}</small></span>
				<span class="dica-linha">
					<i class="ponto" style={`background:${cores[tooltip.tipo]}`} />
					{#if tooltip.total}{Math.round((tooltip.value / tooltip.total) * 100)}% da bancada de {tooltip.total}{:else}{tooltip.tipo}{/if}
				</span>
			</div>
			<svg viewBox={`0 0 ${size} ${size}`} style="width: 100%; height: 100%;">
				{#each layoutRender as node, i (node.label + '-' + node.tipo)}
					<g
						class:bolha={true}
						style={`transform: translate(${node.x.toFixed(1)}px, ${node.y.toFixed(1)}px)`}
						class={hoveredKey && hoveredKey !== `${node.label}-${node.tipo}` ? 'is-dimmed' : ''}
						on:mouseenter={(e) => showTooltip(e, node)}
						on:mousemove={moveTooltip}
						on:mouseleave={hideTooltip}
						on:focus={(e) => showTooltip(e, node)}
						on:blur={hideTooltip}
						on:click={(e) => showTooltip(e, node)}
						role="button"
						aria-label={`${node.label}, ${node.tipo}: ${node.value}`}
						tabindex="0"
					>
						<circle
							r={node.r}
							class="bubble-circle"
							style:--i={i}
							style={`fill: ${cores[node.tipo] || 'var(--color-dark)'}`}
						/>
						{#if node.showLabel && node.r > 14}
							<text
								dy="0.35em"
								style="font-size: var(--t-mini);"
							>
								{node.label}
							</text>
						{/if}
					</g>
				{/each}
			</svg>
		</div>
		{#if onToggle}
			<button type="button" class="bubble-toggle" on:click={onToggle}>
				{layoutMode === 'pack' ? 'Agrupar' : 'Desagrupar'}
			</button>
		{/if}
	</section>

<style>
	.bubble-chart {
		margin: calc(var(--grid) * 2) 0;
	}

	.bubble-chart h3 {
		margin: 0 0 calc(var(--grid) * 1);
		font-family: var(--font-primary);
		font-size: calc(var(--grid) * 1.9);
		font-weight: 600;
		letter-spacing: 0;
        width: 100%;
        text-align: left;
	}

	.bubble-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: calc(var(--grid) * 1.5);
		align-self: center;
		padding: calc(var(--grid) * 0.6) calc(var(--grid) * 1.4);
		border-radius: 999px;
		border: 1px solid var(--color-dark);
		background: transparent;
		color: var(--color-dark);
		font-family: var(--font-primary);
		font-size: var(--t-control);
		font-weight: 500;
		cursor: pointer;
		transition: background-color 180ms var(--ease), color 180ms var(--ease);
	}

	.bubble-chart {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.bubble-toggle:hover {
		background: var(--color-dark);
		color: var(--color-light);
	}
	.uva-container-bubble-chart {
		position: relative;
		width: 100%;
		max-width: 468px;
		aspect-ratio: 1 / 1;
	}

	.uva-tooltip {
		position: fixed;
		margin-left: var(--desvio, 0px);
		transform: translate(-50%, calc(-100% - 16px));
		z-index: 1000;
		transition: opacity 180ms var(--ease);
	}

	.uva-tooltip--baixo {
		transform: translate(-50%, 22px);
	}











	text {
		text-anchor: middle;
		font-family: var(--font-primary);
		font-weight: 600;
		fill: var(--color-tertiary);
		pointer-events: none;
	}

	.bubble-circle {
		transform-box: fill-box;
		transform-origin: center;
		animation: bolha-in 700ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: calc(var(--i) * 9ms);
		stroke: var(--color-light);
		stroke-width: 1.5;
		cursor: pointer;
		transition: r 600ms var(--ease), transform 600ms var(--ease), opacity 180ms var(--ease);
	}

	/* Moving bubbles by CSS transform: no layout reads per bubble, unlike animate:flip */
	.bolha {
		cursor: pointer;
		transition: transform 600ms var(--ease), opacity 180ms var(--ease);
	}

	.is-dimmed {
		opacity: 0.15;
	}
	@media (max-width: 600px) {
		.uva-container-bubble-chart {
			max-width: 100%;
		}
	}
	@keyframes bolha-in {
		from {
			opacity: 0;
			transform: scale(0);
		}
	}
</style>
