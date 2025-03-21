<script lang="ts">
    import type { Feature } from "openchat-client";
    import ModalContent from "../../ModalContentLegacy.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let feature: Feature;
</script>

<ModalContent>
    <span class="header" slot="header">
        <Translatable resourceKey={i18nKey("restricted.title")} />
    </span>
    <form class="body" slot="body">
        {#if feature === "swap"}
            <Translatable resourceKey={i18nKey("restricted.swap")} />
        {:else}
            <Translatable resourceKey={i18nKey("restricted.generic")} />
        {/if}
    </form>
    <span slot="footer">
        <ButtonGroup>
            <Button on:click={() => dispatch("close")}
                ><Translatable resourceKey={i18nKey("close")} /></Button>
        </ButtonGroup>
    </span>
</ModalContent>

<style lang="scss">
</style>
