<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import Translatable from "./Translatable.svelte";
    import { i18nKey } from "../i18n/i18n";
    import ModalContent from "./ModalContent.svelte";
    import Button from "./Button.svelte";
    import { mobileWidth } from "../stores/screenDimensions";
    import ButtonGroup from "./ButtonGroup.svelte";

    const dispatch = createEventDispatcher();

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();
</script>

<ModalContent backgroundImage={"/assets/landscape.png"} {onClose}>
    {#snippet body()}
        <div class="body">
            <h1 class="msg">page not found</h1>
            <div class="not-found"></div>
        </div>
    {/snippet}
    {#snippet footer()}
        <ButtonGroup align={$mobileWidth ? "fill" : "center"}>
            <Button on:click={() => dispatch("close")}>
                <Translatable resourceKey={i18nKey("goHome")} />
            </Button>
        </ButtonGroup>
    {/snippet}
</ModalContent>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $sp5;
    }
    .msg {
        @include font(bold, normal, fs-200);
        text-shadow: 2px 2px #000;
        text-transform: uppercase;
    }

    .not-found {
        background-image: url("/assets/not_found.svg");
        width: 250px;
        height: 250px;

        @include mobile() {
            width: 150px;
            height: 150px;
        }
    }
</style>
