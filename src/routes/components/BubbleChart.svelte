<script>
	import { hierarchy, pack } from 'd3';
	import { flip } from 'svelte/animate';

	export let title = '';
	export let items = [];
	export let size = 400;
	export let padding = 1;
	export let layoutMode = 'pack';
	export let onToggle = null;

	const tipos = ['Sim', 'Não', 'Abstenção', 'Obstrução', 'Ausentes'];
	const cores = {
		Sim: 'var(--color-success)',
		'Não': 'var(--color-danger)',
		Abstenção: 'var(--color-warning)',
		Obstrução: 'var(--color-info)',
		Ausentes: 'var(--color-neutral)'
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
			x: event.clientX - rect.left + 16,
			y: event.clientY - rect.top + 16
		};
	}

	function moveTooltip(event) {
		if (!tooltip.visible) return;
		const rect = event.currentTarget.ownerSVGElement.getBoundingClientRect();
		tooltip = {
			...tooltip,
			x: event.clientX - rect.left + 16,
			y: event.clientY - rect.top + 16
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
				style={`opacity: ${tooltip.visible ? 1 : 0}; left: ${tooltip.x}px; top: ${tooltip.y}px;`}
			>
				<div>{tooltip.label}</div>
				<hr />
				<div>{tooltip.tipo}: {tooltip.value}</div>
			</div>
			<svg viewBox={`0 0 ${size} ${size}`} style="width: 100%; height: 100%;">
				{#each layoutRender as node (node.label + '-' + node.tipo)}
					<g
						transform={`translate(${node.x}, ${node.y})`}
						animate:flip={{ duration: 350 }}
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
								style="font-size: 12px;"
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
		font-size: calc(var(--grid) * 2);
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
		position: absolute;
		pointer-events: none;
		background: var(--color-surface);
		color: var(--color-text);
		padding: calc(var(--grid) * 0.5) calc(var(--grid) * 1);
		border-radius: var(--radius-s);
		box-shadow: var(--shadow-2);
		font-size: calc(var(--grid) * 1.4);
		z-index: 9999;
		transition: opacity 120ms ease;
	}

	.uva-tooltip hr {
		border: none;
		border-top: 1px solid color-mix(in srgb, var(--color-text) 25%, transparent);
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
		stroke: #fff;
		stroke-width: 2;
		cursor: pointer;
		transition: r 400ms ease, transform 400ms ease;
	}

	.is-dimmed {
		opacity: 0.1;
	}
	@media (max-width: 560px) {
		.uva-container-bubble-chart {
			max-width: 100%;
		}
	}
</style>
