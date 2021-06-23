<script>
    import Button from "./Button.svelte";
    import { saveSeletedTheme } from "../theme/themes";
</script>

<div class="theme">
    <Button on:click={() => saveSeletedTheme("batman")}>Batman</Button>
    <Button on:click={() => saveSeletedTheme("light")}>Light</Button>
</div>
<slot />

<style lang="scss">
    .theme {
        position: absolute;
        top: 20px;
        right: 20px;
    }
</style>
