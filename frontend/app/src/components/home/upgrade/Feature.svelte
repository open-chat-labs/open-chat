<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    import MoreInfo from "../../InfoIcon.svelte";

    export let comingSoon: boolean = false;
    export let freeInfo: ResourceKey | undefined = undefined;
    export let diamondInfo: ResourceKey | undefined = undefined;
    export let landing: boolean = false;
</script>

<div class:landing class="title">
    <slot name="title" />
    {#if comingSoon}
        <span class="soon">(<Translatable resourceKey={i18nKey("upgrade.comingSoon")} />)</span>
    {/if}
</div>
<div class:landing class="feature free">
    <slot name="free" />

    {#if freeInfo !== undefined}
        <MoreInfo><Translatable resourceKey={freeInfo} /></MoreInfo>
    {/if}
</div>
<div class:landing class="feature diamond">
    <slot name="diamond" />

    {#if diamondInfo !== undefined}
        <MoreInfo><Translatable resourceKey={diamondInfo} /></MoreInfo>
    {/if}
</div>

<style lang="scss">
    .diamond {
        background-color: rgba(255, 255, 255, 0.05);
    }

    .title {
        display: flex;
        align-items: center;
    }

    .feature,
    .title {
        @include font-size(fs-80);
        color: var(--txt-light);
        padding: 6px;
        border-bottom: 1px solid var(--bd);
    }

    .feature {
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
    }

    .soon {
        @include font(light, normal, fs-50);
        margin-left: $sp2;
    }

    .landing {
        @include font-size(fs-120);
        color: var(--landing-txt-light);
    }
</style>
