<script lang="ts">
    export let underline: "never" | "always" | "hover" = "never";

    let anchorElement: HTMLElement;

    export function getBoundingRect(): DOMRect {
        return anchorElement.getBoundingClientRect();
    }
</script>

<a
    bind:this={anchorElement}
    role="button"
    href="/"
    class={underline}
    class:hover={underline === "hover"}
    on:click|preventDefault|stopPropagation>
    <slot />
</a>

<style lang="scss">
    a {
        cursor: pointer;
    }

    .hover:hover {
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp2;
        text-decoration-thickness: 2px;
    }

    .always {
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp2;
        &:hover {
            text-decoration-thickness: 2px;
        }
    }
</style>
