<script lang="ts">
    import type { Snippet } from "svelte";
    import Alert from "svelte-material-icons/Alert.svelte";
    import { iconSize } from "../stores/iconSize";

    type Props = {
        icon?: boolean;
        children?: Snippet
    }

    let { icon = true, children }: Props = $props();
</script>

<div class="alert-box">
    {#if icon}
        <div class="alert">
            <Alert size={$iconSize} color={"var(--warn"} />
        </div>
    {/if}
    <div class="alert-txt">
        {@render children?.()}
    </div>
</div>

<style lang="scss">
    .alert-box {
        padding: $sp4;
        border: var(--bw) solid var(--warn);
        display: flex;
        align-items: flex-start;
        gap: $sp3;
        border-radius: var(--rd);
        margin-bottom: $sp4;

        .alert {
            flex: 0 0 25px;
        }

        .alert-txt {
            flex: auto;
            text-align: start;
        }
    }
</style>
