<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import BotBuilder from "./BotBuilder.svelte";

    // This is just a dummy modal for dev purposes. For the real thing the bot builder
    // will be embedded in the make proposal UI

    let valid = $state(false);
</script>

<ModalContent on:close>
    <div class="header" slot="header">Build a bot</div>
    <div class="body" slot="body">
        <BotBuilder bind:valid />
    </div>
</ModalContent>

<style lang="scss">
</style>
