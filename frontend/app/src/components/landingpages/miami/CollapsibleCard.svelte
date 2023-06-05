<script lang="ts">
    import HoverIcon from "../../HoverIcon.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import Minus from "svelte-material-icons/Minus.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { mobileWidth } from "../../../stores/screenDimensions";
    export let title: string;

    let open = !$mobileWidth;
</script>

<div on:click={() => (open = !open)} class="card">
    <div class:open class="header">
        <div class="title">{title}</div>
        <div class="icon">
            <HoverIcon>
                {#if open}
                    <Minus size={$iconSize} color={"var(--txt)"} />
                {:else}
                    <Plus size={$iconSize} color={"var(--txt)"} />
                {/if}
            </HoverIcon>
        </div>
    </div>
    {#if open}
        <div class:open class="body">
            <slot />
        </div>
    {/if}
</div>

<style lang="scss">
    $ckbtc: #4e27c7;
    .card {
        margin-bottom: $sp5;
    }
    .header {
        padding: 8px 16px;
        @include font(bold, normal, fs-100, 28);
        background-color: var(--input-bg);
        border-radius: $sp2;
        border-top: 1px solid $ckbtc;
        color: var(--txt);
        font-weight: 700;
        display: flex;
        align-items: center;

        .icon {
            flex: 0 0 20px;
        }
        .title {
            flex: auto;
        }

        &.open {
            background-color: $ckbtc;
            border-radius: $sp2 $sp2 0 0;
        }
    }

    .body {
        padding: 0 16px 8px 16px;
        background-color: $ckbtc;
        border-radius: 0 0 $sp2 $sp2;
        color: #d3d3d3;
    }
</style>
