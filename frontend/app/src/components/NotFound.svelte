<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import Translatable from "./Translatable.svelte";
    import { i18nKey } from "../i18n/i18n";
    import ModalContent from "./ModalContent.svelte";
    import Button from "./Button.svelte";
    import { mobileWidth } from "../stores/screenDimensions";
    import ButtonGroup from "./ButtonGroup.svelte";

    const dispatch = createEventDispatcher();
</script>

<ModalContent on:close>
    <div class="body" slot="body">
        <div class="not-found" />
        <h1 class="msg">404</h1>
    </div>
    <div slot="footer">
        <ButtonGroup align={$mobileWidth ? "fill" : "center"}>
            <Button on:click={() => dispatch("close")}>
                <Translatable resourceKey={i18nKey("goHome")} />
            </Button>
        </ButtonGroup>
    </div>
</ModalContent>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    .msg {
        @include font(bold, normal, fs-260);
        text-shadow: 3px 3px #000;
        color: #ffffff;
    }

    .not-found {
        background-image: url("/assets/not_found.svg");
        width: 250px;
        height: 260px;

        @include mobile() {
            width: 150px;
            height: 160px;
        }
    }
</style>
