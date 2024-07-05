<script lang="ts">
    import { type AccessGate, type Level } from "openchat-client";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import LeafGateBuilder from "./LeafGateBuilder.svelte";

    export let gate: AccessGate;
    export let editable: boolean;
    export let level: Level;
    export let valid: boolean;
</script>

<Overlay>
    <ModalContent closeIcon on:close>
        <div slot="header">Create an access gate</div>
        <div class="body" slot="body">
            <LeafGateBuilder bind:gate {editable} {level} bind:valid />
        </div>
        <div let:onClose slot="footer">
            <Button on:click={onClose} disabled={!valid}>
                <Translatable resourceKey={i18nKey("close")} />
            </Button>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
</style>
