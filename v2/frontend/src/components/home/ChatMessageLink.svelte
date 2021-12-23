<script lang="ts">
    export let href = "";
    export let title: string | undefined = undefined;

    const target: string = "_blank";
</script>

<a {target} {href} {title}><slot /></a>
