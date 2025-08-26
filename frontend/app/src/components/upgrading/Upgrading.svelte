<script lang="ts">
    import { i18nKey } from "../../i18n/i18n";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Translatable from "../Translatable.svelte";
</script>

<Overlay>
    <ModalContent hideHeader hideFooter>
        {#snippet body()}
            <div class="body">
                <div>
                    <h1 class="title">
                        <Translatable resourceKey={i18nKey("performingUpgrade")} />
                    </h1>
                    <p class="blurb"><Translatable resourceKey={i18nKey("pleaseWait")} /></p>
                </div>
                <div class="spinner"></div>
            </div>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .body {
        text-align: center;
    }
    .blurb {
        @include font(light, normal, fs-120);
        margin-bottom: $sp6;
    }

    .title {
        @include font(bold, normal, fs-220);
        margin: $sp4;
        text-align: center;
        text-shadow: var(--modalPage-txt-sh);
    }

    .spinner {
        height: 80px;
        width: 100%;
        @include loading-spinner(3em, 1.5em, var(--button-bg));
    }
</style>
