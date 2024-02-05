<script lang="ts">
    import { i18nKey } from "../i18n/i18n";
    import ModalPage from "./ModalPage.svelte";
    import Translatable from "./Translatable.svelte";
    import Markdown from "./home/Markdown.svelte";
    import { _ } from "svelte-i18n";
</script>

<ModalPage>
    <h4 class="title"><Translatable resourceKey={i18nKey("switchDomain.title")} /></h4>

    <div class="blurb">
        <Markdown
            text={$_("switchDomain.blurb", {
                values: { currentDomain: window.location.origin },
            })} />
    </div>
</ModalPage>

<style lang="scss">
    .title {
        @include font(bold, normal, fs-120);
        margin-bottom: $sp5;
    }
</style>
