<script>
	import { createEventDispatcher } from 'svelte';
	import { base } from '$app/paths';
	import Abas from './ui/Abas.svelte';

	/** 'camara' or 'senado' */
	export let casa = 'camara';
	/** 'votacoes', 'parlamentares' or 'governabilidade' */
	export let secao = 'votacoes';
	/** On the home page the house switches in place: it emits 'casa' instead of following a link */
	export let casaNoLugar = false;

	const dispatch = createEventDispatcher();

	// Where each section lives in each house
	const ROTAS = {
		votacoes: { camara: '/', senado: '/?casa=senado' },
		parlamentares: { camara: '/deputados', senado: '/senadores' },
		governabilidade: { camara: '/governabilidade', senado: '/governabilidade/senado' }
	};
	const rota = (s, c) => `${base}${ROTAS[s][c]}`;

	// Switching house keeps the section
	$: casas = [
		{ chave: 'camara', rotulo: 'Câmara', href: casaNoLugar ? null : rota(secao, 'camara') },
		{ chave: 'senado', rotulo: 'Senado', href: casaNoLugar ? null : rota(secao, 'senado') }
	];

	$: secoes = [
		{ chave: 'votacoes', rotulo: 'Votações', href: rota('votacoes', casa) },
		{
			chave: 'parlamentares',
			rotulo: 'Como cada um vota',
			curto: casa === 'senado' ? 'Senadores' : 'Deputados',
			href: rota('parlamentares', casa)
		},
		{ chave: 'governabilidade', rotulo: 'Governabilidade', curto: 'Governo', href: rota('governabilidade', casa) }
	];
</script>

<!-- The slot holds extras for the same bar, like the previous/next arrows of a profile -->
<nav class="navegacao" class:com-extra={$$slots.default} aria-label="Seções">
	<div class="g-casa">
		<Abas
			itens={casas}
			ativo={casa}
			grupo="casa"
			rotulo="Casa legislativa"
			estilo="segmento"
			on:escolher={(e) => casaNoLugar && dispatch('casa', e.detail)}
		/>
	</div>
	<div class="g-secao">
		<Abas itens={secoes} ativo={secao} grupo="secao" rotulo="Seção" estilo="sublinhado" />
	</div>
	{#if $$slots.default}<div class="extra"><slot /></div>{/if}
</nav>

<style>
	.navegacao {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: calc(var(--grid) * 1.2) calc(var(--grid) * 2.4);
	}

	.extra {
		margin-left: auto;
	}

	@media (max-width: 600px) {
		/* Tighter, so the house switch and a profile's arrows fit on one line */
		.navegacao {
			column-gap: var(--grid);
		}

		/* The sections take a line of their own; as underlined tabs they span it */
		.g-secao {
			order: 2;
			flex-basis: 100%;
		}

		.g-secao :global(.abas) {
			display: flex;
		}

		/* The house tabs and the extras share the first line */
		.com-extra .extra {
			order: 1;
			margin-left: auto;
		}
	}
</style>
