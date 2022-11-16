<script lang="ts">
    import Button from "../Button.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
</script>

<div class="wrapper">
    <h2 class="title">{$_("noChatSelected")}</h2>
    <p class="subtitle label_one">{$_("selectAChat")}</p>
    <Button on:click={() => dispatch("recommend")}>{$_("showHotGroups")}</Button>
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: center;
        text-align: center;
        align-items: center;
        height: 100%;
    }

    .subtitle {
        margin-bottom: $sp5;
    }

    .title {
        margin-bottom: $sp3;
    }
</style>
