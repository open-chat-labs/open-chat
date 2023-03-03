<script lang="ts">
    import { location } from "../../routes";
    export let id: string;
</script>

<a href={`${$location}?section=${id}`}><slot /></a>
