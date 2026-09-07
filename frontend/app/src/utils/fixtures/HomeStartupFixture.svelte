<script lang="ts">
    import type { Snippet } from "svelte";

    let { label, children, onClose }: { label: string; children?: Snippet; onClose?: () => void } =
        $props();
    let code = $state("");
</script>

<section data-startup-fixture={label}>
    {#if label === "onboarding"}
        <button>Existing user</button>
        <button>Create account</button>
        <input aria-label="Linking code" bind:value={code} />
        {#if onClose}
            <button onclick={onClose}>Close welcome</button>
        {/if}
    {/if}
    {@render children?.()}
</section>
