<script>
    import Button from "./Button.svelte";

    import { saveSeletedTheme } from "../theme/themes";

    function setDir(dir) {
        document.dir = dir;
    }
</script>

<div class="theme">
    <Button small={true} on:click={() => saveSeletedTheme("batman")}>Batman</Button>
    <Button small={true} on:click={() => saveSeletedTheme("light")}>Light</Button>
</div>
<div class="locale">
    <Button small={true} on:click={() => setDir("rtl")}>RTL</Button>
    <Button small={true} on:click={() => setDir("ltr")}>LTR</Button>
</div>
<slot />

<style lang="scss">
    .theme {
        position: absolute;
        z-index: 10;
        top: 10px;
        right: 10px;
    }
    .locale {
        position: absolute;
        z-index: 10;
        top: 10px;
        left: 10px;
    }
</style>
