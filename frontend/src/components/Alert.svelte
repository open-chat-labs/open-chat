<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import ModalContent from "./ModalContent.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import Button from "./Button.svelte";
    import { _ } from "svelte-i18n";

    const dispatch = createEventDispatcher();

    export let message: string;
</script>

<ModalContent hideHeader hideFooter fixedWidth={false}>
    <span slot="body">
        <p>{message}</p>
        <ButtonGroup>
            <Button small={true} on:click={() => dispatch("close")}>{$_("close")}</Button>
        </ButtonGroup>
    </span>
</ModalContent>

<style type="text/scss">
    p {
        margin-bottom: $sp5;
    }
</style>
