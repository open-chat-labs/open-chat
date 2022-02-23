<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    export let open: boolean;
</script>

<Overlay bind:active={open}>
    <ModalContent fill={true}>
        <span slot="header">Create a poll</span>
        <span class="body" slot="body"> stuff </span>
        <span slot="footer">
            <ButtonGroup>
                <Button small={true}>{$_("save")}</Button>
                <Button small={true} secondary={true}>{$_("cancel")}</Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    .body {
        padding: $sp5;
    }
</style>
