<script lang="ts">
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../i18n/i18n";
    import ModalContent from "./ModalContent.svelte";
    import Overlay from "./Overlay.svelte";
    import Translatable from "./Translatable.svelte";
    import Markdown from "./home/Markdown.svelte";
</script>

<Overlay>
    <ModalContent hideHeader hideFooter>
        {#snippet body()}
            <h4 class="title"><Translatable resourceKey={i18nKey("switchDomain.title")} /></h4>

            <div class="blurb">
                <Markdown
                    text={$_("switchDomain.blurb", {
                        values: { currentDomain: window.location.origin },
                    })} />
            </div>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .title {
        @include font(bold, normal, fs-120);
        margin-bottom: $sp5;
    }
</style>
