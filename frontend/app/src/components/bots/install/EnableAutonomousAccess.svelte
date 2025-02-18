<script lang="ts">
    import { type Level } from "openchat-client";
    import Translatable from "../../Translatable.svelte";
    import Legend from "../../Legend.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    interface Props {
        level: Level;
    }

    let { level }: Props = $props();
</script>

<Legend large label={i18nKey("bots.add.enableAutonomousAccess", undefined, level, true)}></Legend>
<p class="info">
    <Translatable
        resourceKey={i18nKey("bots.add.enableAutonomousAccessBlurb", undefined, level, true)}
    ></Translatable>
</p>

<style lang="scss">
    .info {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
        margin-bottom: $sp4;
    }
</style>
