<script lang="ts">
    import type { Snippet } from "svelte";
    import { fade } from "svelte/transition";

    interface Props {
        children: Snippet<[(action: string) => void]>;
    }

    let { children }: Props = $props();
    let action = $state<string>();
    let timer = $state<number>();

    function onAction(payload: unknown) {
        action = `${payload} (${new Date().toTimeString()})`;
        if (timer !== undefined) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => (action = undefined), 2000);
    }
</script>

{@render children(onAction)}

{#if action}
    <pre transition:fade>{action}</pre>
{/if}

<style lang="scss">
    pre {
        font-size: 12px;
        padding: 20px;
    }
</style>
