<script lang="ts">
    import { i18nKey } from "../../../i18n/i18n";
    import Legend from "../../../components/Legend.svelte";
    import Translatable from "../../../components/Translatable.svelte";
</script>

<Legend large label={i18nKey("bots.add.subscribeTitle")}></Legend>
<p class="info">
    <Translatable resourceKey={i18nKey("bots.add.subscribeBlurb")}></Translatable>
</p>

<style lang="scss">
    .info {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
        margin-bottom: $sp4;
    }
</style>
