<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../stores/screenDimensions";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Button from "../Button.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    $: identityState = client.identityState;

    function cancel() {
        if (client.anonUser && $identityState === "logging_in") {
            identityState.set("anon");
        }
        dispatch("close");
    }
</script>

<ModalContent hideFooter fixedWidth={$mobileWidth} fitToContent={!$mobileWidth}>
    <div class="header" slot="header">{$_("loggingIn")}</div>
    <div class="body" slot="body">
        <div class="spinner">
            <FancyLoader />
        </div>
        <p class="sub">{$_("loggingInMsg")}</p>
        <Button small on:click={cancel}>{$_("cancel")}</Button>
    </div>
</ModalContent>

<style lang="scss">
    .header,
    .body {
        text-align: center;
    }
    .spinner {
        width: 100px;
        margin: $sp4 auto;
    }
    .sub {
        margin-bottom: $sp4;
    }
</style>
