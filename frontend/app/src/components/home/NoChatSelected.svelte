<script lang="ts">
    import Button from "../Button.svelte";
    import { _ } from "svelte-i18n";
    import page from "page";
</script>

<div class="wrapper">
    <h2 class="title">{$_("noChatSelected")}</h2>
    <p class="subtitle">{$_("selectAChat")}</p>
    <Button on:click={() => page("/hotgroups")}>{$_("showHotGroups")}</Button>
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
        @include font(bold, normal, fs-180);
        margin-bottom: $sp3;
    }
</style>
