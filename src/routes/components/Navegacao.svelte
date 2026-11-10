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

	// Governability uses the Câmara's history of government orientations; the Senado has none
	$: soCamara = secao === 'governabilidade';

	// The same section in the other house
	const destino = (c) =>
		secao === 'parlamentares' ? `${base}/${c === 'senado' ? 'senadores' : 'deputados'}` : `${base}/${c === 'senado' ? '?casa=senado' : ''}`;

	$: casas = [
		{ chave: 'camara', rotulo: 'Câmara', href: casaNoLugar ? null : destino('camara') },
		{
			chave: 'senado',
			rotulo: 'Senado',
			href: casaNoLugar ? null : destino('senado'),
			desabilitado: soCamara,
			titulo: soCamara ? 'Só a Câmara publica o histórico de orientações do governo' : undefined
		}
	];

	$: secoes = [
		{ chave: 'votacoes', rotulo: 'Votações', href: `${base}/${casa === 'senado' ? '?casa=senado' : ''}` },
		{
			chave: 'parlamentares',
			rotulo: 'Como cada um vota',
			curto: casa === 'senado' ? 'Senadores' : 'Deputados',
			href: `${base}/${casa === 'senado' ? 'senadores' : 'deputados'}`
		},
		{ chave: 'governabilidade', rotulo: 'Governabilidade', curto: 'Governo', href: `${base}/governabilidade` }
	];
</script>

<!-- The slot holds extras for the same bar, like the previous/next arrows of a profile -->
<nav class="navegacao" class:com-extra={$$slots.default} aria-label="Seções">
	<div class="g-casa">
		<Abas itens={casas} ativo={casa} grupo="casa" rotulo="Casa legislativa" on:escolher={(e) => casaNoLugar && dispatch('casa', e.detail)} />
	</div>
	<div class="g-secao"><Abas itens={secoes} ativo={secao} grupo="secao" rotulo="Seção" /></div>
	{#if $$slots.default}<div class="extra"><slot /></div>{/if}
</nav>

<style>
	.navegacao {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: calc(var(--grid) * 1.2);
	}

	.extra {
		margin-left: auto;
	}

	/* Phone: the house tabs and the extras share the first line, the sections take the second */
	@media (max-width: 600px) {
		.com-extra .extra {
			order: 1;
		}

		.com-extra .g-secao {
			order: 2;
			flex-basis: 100%;
		}
	}
</style>
