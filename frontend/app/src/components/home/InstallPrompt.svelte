<script lang="ts">
    import { onMount } from "svelte";
    import { isLoading } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { showHomeScreenPrompt } from "../../stores/settings";
    import Checkbox from "../Checkbox.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Translatable from "../Translatable.svelte";

    let installed = window.matchMedia("(display-mode: standalone)").matches;
    let dismissed = $state(false);
    let show = $state(false);

    onMount(() => {
        show = !installed && $showHomeScreenPrompt;
    });

    function onClose() {
        dismissed = true;
    }
</script>

{#if show && !dismissed && !$isLoading}
    <Overlay dismissible {onClose}>
        <ModalContent {onClose} closeIcon hideFooter>
            {#snippet header()}
                <div class="header">
                    <Translatable resourceKey={i18nKey("install.title")} />
                </div>
            {/snippet}
            {#snippet body()}
                <div class="body">
                    <div class="msg">
                        <Translatable resourceKey={i18nKey("install.message")} />
                    </div>
                    <img class="how" src="/assets/add_home_ios.gif" alt="add to home screen" />
                    <div class="dont-show">
                        <Checkbox
                            id="dont_show"
                            label={i18nKey("install.dontShow")}
                            checked={!$showHomeScreenPrompt}
                            onChange={showHomeScreenPrompt.toggle}>
                        </Checkbox>
                    </div>
                </div>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    .header,
    .body {
        color: var(--txt);
    }
    .body {
        display: flex;
        flex-direction: column;
        gap: $sp4;
        align-items: center;
    }
    .dont-show {
        width: 100%;
    }
    .how {
        width: 50%;
    }
</style>
