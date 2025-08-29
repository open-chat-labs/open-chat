<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        children?: Snippet;
        style: "default" | "pressed" | "active";
        onClick?: (e: MouseEvent) => void;
        icon: Snippet<[string]>;
    }
    let { children, icon, onClick, style }: Props = $props();

    let iconColour = "var(--primary)";
</script>

<button onclick={onClick} class={`${style}`}>
    <span class="content">{@render children?.()}</span>
    {#if icon}
        <span class="icon">{@render icon(iconColour)}</span>
    {/if}
</button>

<style lang="scss"></style>
