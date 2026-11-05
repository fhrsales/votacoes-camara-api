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

/** Counts a number up (or down) to its new value whenever it changes. */
export function countUp(node, value) {
	let frame;
	let current = 0;
	const format = (n) => Math.round(n).toLocaleString('pt-BR');

	function run(target) {
		cancelAnimationFrame(frame);
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
