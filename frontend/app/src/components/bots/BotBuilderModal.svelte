<script lang="ts">
    import { i18nKey } from "../../i18n/i18n";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import BotBuilder from "./BotBuilder.svelte";

    // This is just a dummy modal for dev purposes. For the real thing the bot builder
    // will be embedded in the make proposal UI

    let valid = $state(false);

    function onUpdate() {}
</script>

<ModalContent on:close>
    <div class="header" slot="header">
        <Translatable resourceKey={i18nKey("bots.builder.title")}></Translatable>
    </div>
    <div class="body" slot="body">
        <BotBuilder {onUpdate} bind:valid />
    </div>
</ModalContent>

<style lang="scss">
</style>
