<script>
	import { hierarchy, pack } from 'd3';
	import { portal } from '$lib/motion.js';

	export let title = '';
	export let items = [];
	export let size = 400;
	export let padding = 1;
	export let layoutMode = 'pack';
	export let onToggle = null;

	const tipos = ['Sim', 'Não', 'Abstenção', 'Obstrução', 'Ausentes'];
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

	function showTooltip(event, item) {
		hoveredKey = `${item.label}-${item.tipo}`;
		const rect = event.currentTarget.ownerSVGElement.getBoundingClientRect();
		tooltip = {
			visible: true,
			label: item.label,
			value: item.value,
			tipo: item.tipo,
			total: items.filter((d) => d.label === item.label).reduce((a, d) => a + d.value, 0),
			x: Math.min(Math.max(event.clientX, 120), window.innerWidth - 120),
			y: event.clientY,
			baixo: event.clientY < 220
		};
	}

	function moveTooltip(event) {
		if (!tooltip.visible) return;
		const rect = event.currentTarget.ownerSVGElement.getBoundingClientRect();
		tooltip = {
			...tooltip,
			x: Math.min(Math.max(event.clientX, 120), window.innerWidth - 120),
			y: event.clientY,
			baixo: event.clientY < 220
		};
	}

	function hideTooltip() {
		tooltip = { ...tooltip, visible: false };
		hoveredKey = '';
	}
</script>

	<section class="bubble-chart">
		{#if title}
			<h3>{title}</h3>
		{/if}
		<div class="uva-container-bubble-chart">
			<div
				class="uva-tooltip"
				class:uva-tooltip--baixo={tooltip.baixo}
				use:portal
				style={`opacity: ${tooltip.visible ? 1 : 0}; left: ${tooltip.x}px; top: ${tooltip.y}px;`}
			>
				<span class="tip-label">{tooltip.label}</span>
				<span class="tip-linha">
					<b>{tooltip.value}</b>
					<span class="tip-tipo"><i style={`background:${cores[tooltip.tipo]}`} />{tooltip.tipo}</span>
				</span>
				{#if tooltip.total}
					<span class="tip-pct">{Math.round((tooltip.value / tooltip.total) * 100)}% da bancada de {tooltip.total}</span>
				{/if}
			</div>
			<svg viewBox={`0 0 ${size} ${size}`} style="width: 100%; height: 100%;">
				{#each layoutRender as node (node.label + '-' + node.tipo)}
					<g
						class:bolha={true}
						style={`transform: translate(${node.x.toFixed(1)}px, ${node.y.toFixed(1)}px)`}
						class={hoveredKey && hoveredKey !== `${node.label}-${node.tipo}` ? 'is-dimmed' : ''}
						on:mouseenter={(e) => showTooltip(e, node)}
						on:mousemove={moveTooltip}
						on:mouseleave={hideTooltip}
						on:focus={(e) => showTooltip(e, node)}
						on:blur={hideTooltip}
						role="button"
						tabindex="0"
					>
						<circle
							r={node.r}
							class="bubble-circle"
							style={`fill: ${cores[node.tipo] || 'var(--color-dark)'}`}
						/>
						{#if node.showLabel && node.r > 14}
							<text
								dy="0.35em"
								style="font-size: 13px;"
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
		padding: 6px 14px;
		border-radius: 20px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		background: var(--color-dark);
		color: var(--color-tertiary);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}

	.bubble-chart {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.bubble-toggle:hover {
		background: var(--color-tertiary);
		color: var(--color-dark);
	}
	.uva-container-bubble-chart {
		position: relative;
		width: 100%;
		max-width: 468px;
		aspect-ratio: 1 / 1;
	}

	.uva-tooltip {
		position: fixed;
		pointer-events: none;
		background: var(--color-dark);
		color: var(--color-light);
		padding: calc(var(--grid) * 1.1) calc(var(--grid) * 1.6);
		border-radius: 14px;
		box-shadow: var(--shadow-2);
		font-size: var(--t-small);
		white-space: nowrap;
		transform: translate(-50%, calc(-100% - 16px));
		z-index: 1000;
		transition: opacity 180ms var(--ease);
	}

	.uva-tooltip--baixo {
		transform: translate(-50%, 22px);
	}

	.uva-tooltip--baixo::after {
		top: auto !important;
		bottom: 100%;
		border-top-color: transparent !important;
		border-bottom-color: var(--color-dark);
	}

	.uva-tooltip::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 100%;
		transform: translateX(-50%);
		border: 7px solid transparent;
		border-top-color: var(--color-dark);
	}

	.uva-tooltip {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.tip-label {
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.tip-linha {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}

	.tip-linha b {
		font-family: var(--font-display);
		font-weight: 500;
		font-size: calc(var(--grid) * 3.6);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.tip-tipo {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
	}

	.tip-tipo i {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-light) 25%, transparent);
	}

	.tip-pct {
		font-size: calc(var(--grid) * 1.6);
		opacity: 0.7;
	}

	.uva-tooltip hr {
		border: none;
		border-top: 1px solid color-mix(in srgb, var(--color-light) 30%, transparent);
		margin: calc(var(--grid) * 0.4) 0;
	}

	text {
		text-anchor: middle;
		font-family: var(--font-primary);
		font-weight: 600;
		fill: var(--color-tertiary);
		pointer-events: none;
	}

	.bubble-circle {
		stroke: var(--color-light);
		stroke-width: 1.5;
		cursor: pointer;
		transition: r 600ms var(--ease), transform 600ms var(--ease), opacity 180ms var(--ease);
	}

	/* Moving bubbles by CSS transform: no layout reads per bubble, unlike animate:flip */
	.bolha {
		transition: transform 600ms var(--ease), opacity 180ms var(--ease);
	}

	.is-dimmed {
		opacity: 0.15;
	}
	@media (max-width: 560px) {
		.uva-container-bubble-chart {
			max-width: 100%;
		}
	}
</style>
