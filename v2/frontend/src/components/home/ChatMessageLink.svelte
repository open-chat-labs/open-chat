<script lang="ts">
    export let href = "";
    export let title: string | undefined = undefined;

    const target: string = "_blank";
</script>
  
<a {target} {href} {title}><slot></slot></a>

<style type="text/scss">
    a {
        cursor: pointer;
        text-decoration: underline;
    }
</style>
