<script lang="ts">
    import { isLoading } from "svelte-i18n";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import { showHomeScreenPrompt } from "../../stores/settings";
    import Checkbox from "../Checkbox.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import { onMount } from "svelte";

    let installed = window.matchMedia("(display-mode: standalone)").matches;
    let dismissed = $state(false);
    let show = $state(false);

    onMount(() => {
        show = !installed && $showHomeScreenPrompt;
    });
</script>

{#if show && !dismissed && !$isLoading}
    <Overlay dismissible>
        <ModalContent on:close={() => (dismissed = true)} closeIcon hideFooter>
            <div slot="header" class="header">
                <Translatable resourceKey={i18nKey("install.title")} />
            </div>
            <div slot="body" class="body">
                <div class="msg">
                    <Translatable resourceKey={i18nKey("install.message")} />
                </div>
                <img class="how" src="/assets/add_home_ios.gif" alt="add to home screen" />
                <div class="dont-show">
                    <Checkbox
                        id="dont_show"
                        label={i18nKey("install.dontShow")}
                        checked={!$showHomeScreenPrompt}
                        on:change={showHomeScreenPrompt.toggle}>
                    </Checkbox>
                </div>
            </div>
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
