<script>
	import ListaParlamentares from '../components/ListaParlamentares.svelte';

	export let data;
</script>

<ListaParlamentares {data} casa="camara" />
