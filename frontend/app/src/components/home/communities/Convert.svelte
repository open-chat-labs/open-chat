<script lang="ts">
    import type { GroupChatSummary } from "openchat-client";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import { _ } from "svelte-i18n";

    export let group: GroupChatSummary | undefined;

    let converting = false;

    function convert() {
        if (group === undefined) return;
    }

    function close() {
        group = undefined;
    }
</script>

{#if group !== undefined}
    <Overlay dismissible on:close={close}>
        <ModalContent on:close={close}>
            <div slot="header">{$_("communities.convert")}</div>
            <div slot="body">explain what will happen etc</div>
            <div slot="footer">
                <ButtonGroup>
                    <Button secondary on:click={close}>{$_("cancel")}</Button>
                    <Button disabled={converting} loading={converting} on:click={convert}
                        >{$_("communities.convertButton")}</Button>
                </ButtonGroup>
            </div>
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
</style>
