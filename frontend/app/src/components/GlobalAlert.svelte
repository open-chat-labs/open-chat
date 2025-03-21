<script lang="ts">
    import AlertOutline from "svelte-material-icons/AlertOutline.svelte";
    import Overlay from "./Overlay.svelte";
    import ModalContent from "./ModalContent.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import Button from "./Button.svelte";
    import Translatable from "./Translatable.svelte";
    import { i18nKey } from "../i18n/i18n";
    import Link from "./Link.svelte";
    import page from "page";

    let show = $state(true);

    function close() {
        show = false;
    }

    function showMessage() {
        close();
        page(
            "/community/dgegb-daaaa-aaaar-arlhq-cai/channel/12148470416168947889486180374669069959/136",
        );
    }
</script>

{#if show}
    <Overlay dismissible={false}>
        <ModalContent>
            {#snippet header()}
                <span class="header">
                    <AlertOutline size={"1.5em"} color={"currentColor"} />
                    <span>Service update</span>
                </span>
            {/snippet}
            {#snippet body()}
                <span>
                    We are experiencing ongoing issues at the moment as described
                    <Link underline={"hover"} on:click={showMessage}>here</Link>. We are working
                    hard to resolve them as soon as possible but you may experience some disruption
                    in the meantime.
                </span>
            {/snippet}
            {#snippet footer()}
                <ButtonGroup>
                    <Button small on:click={close}>
                        <Translatable resourceKey={i18nKey("close")} />
                    </Button>
                </ButtonGroup>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    .header {
        display: flex;
        gap: $sp4;
    }
</style>
