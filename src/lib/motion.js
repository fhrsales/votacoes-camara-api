// Motion helpers following the Portfolio rules:
// transform/opacity only, 600ms entrances, cubic-bezier(0.2, 0.8, 0.2, 1),
// and the final state straight away under prefers-reduced-motion.

export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

function reducedMotion() {
	return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function easeOut(t) {
	return 1 - Math.pow(1 - t, 3);
}

/** A block that settles 28px upward while fading in, once, when it enters the viewport. */
export function reveal(node, { delay = 0 } = {}) {
	if (reducedMotion() || typeof IntersectionObserver === 'undefined') return {};
	node.style.opacity = '0';
	node.style.transform = 'translateY(28px)';
	node.style.transition = `opacity 600ms ${EASE} ${delay}ms, transform 600ms ${EASE} ${delay}ms`;
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				node.style.opacity = '1';
				node.style.transform = 'none';
				observer.disconnect();
			}
		},
		{ threshold: 0.12 }
	);
	observer.observe(node);
	return { destroy: () => observer.disconnect() };
}

/**
 * Counts a number up (or down) to its new value whenever it changes.
 * Pass a number, or [number, decimals] for values like 9,6.
 */
export function countUp(node, value) {
	let frame;
	let current = 0;
	let casas = 0;
	const format = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

	function run(entrada) {
		cancelAnimationFrame(frame);
		const [target, c = 0] = Array.isArray(entrada) ? entrada : [entrada, 0];
		casas = c;
		const to = Number(target) || 0;
		if (reducedMotion()) {
			current = to;
			node.textContent = format(to);
			return;
		}
		const from = current;
		const start = performance.now();
		const duration = 600;
		const step = (now) => {
			const t = Math.min(1, (now - start) / duration);
			current = from + (to - from) * easeOut(t);
			node.textContent = format(current);
			if (t < 1) frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
	}

	run(value);
	return {
		update: run,
		destroy: () => cancelAnimationFrame(frame)
	};
}

/** Adds .em-vista once the node is seen, which releases its paused entrance animations. */
export function emVista(node) {
	if (typeof IntersectionObserver === 'undefined') {
		node.classList.add('em-vista');
		return {};
	}
	const observer = new IntersectionObserver(
		(entradas) => {
			if (entradas.some((e) => e.isIntersecting)) {
				node.classList.add('em-vista');
				observer.disconnect();
			}
		},
		{ threshold: 0.18 }
	);
	observer.observe(node);
	return { destroy: () => observer.disconnect() };
}

/**
 * Keeps a tooltip fully inside the window: after it is placed, it measures itself and
 * slides sideways by --desvio. Its arrow uses the same variable to keep pointing at the item.
 */
export function manterNaTela(node) {
	if (typeof window === 'undefined') return {};
	const margem = 8;
	function ajustar() {
		node.style.setProperty('--desvio', '0px');
		const r = node.getBoundingClientRect();
		let d = 0;
		if (r.width && r.left < margem) d = margem - r.left;
		else if (r.width && r.right > window.innerWidth - margem) d = window.innerWidth - margem - r.right;
		node.style.setProperty('--desvio', `${Math.round(d)}px`);
	}
	const agendar = () => {
		ajustar();
		requestAnimationFrame(ajustar);
	};
	agendar();
	const pai = node.parentElement;
	pai?.addEventListener('mouseenter', agendar);
	window.addEventListener('resize', agendar);
	return {
		update: agendar,
		destroy() {
			pai?.removeEventListener('mouseenter', agendar);
			window.removeEventListener('resize', agendar);
		}
	};
}

/** Moves a node to <body>, so fixed tooltips escape stacking contexts and sticky bars. */
export function portal(node) {
	if (typeof document === 'undefined') return {};
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		}
	};
}
