<script lang="ts">
    import { _ } from "svelte-i18n";
    import MoreInfo from "./MoreInfo.svelte";

    export let comingSoon: boolean = false;
    export let freeInfo: string | undefined = undefined;
    export let diamondInfo: string | undefined = undefined;
</script>

<div class="title">
    <slot name="title" />
    {#if comingSoon}
        <span class="soon">({$_("upgrade.comingSoon")})</span>
    {/if}
</div>
<div class="feature free">
    <slot name="free" />

    {#if freeInfo !== undefined}
        <MoreInfo>{freeInfo}</MoreInfo>
    {/if}
</div>
<div class="feature diamond">
    <slot name="diamond" />

    {#if diamondInfo !== undefined}
        <MoreInfo>{diamondInfo}</MoreInfo>
    {/if}
</div>

<style type="text/scss">
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
    }

    .soon {
        @include font(light, normal, fs-50);
        margin-left: $sp2;
    }
</style>
