<script lang="ts">
    import type { BorderRadiusSize } from "component-lib";

    type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "huge";

    interface Props {
        url: string;
        size?: AvatarSize;
        name?: string;
        radius?: BorderRadiusSize;
        borderWidth?: "zero" | "thin" | "thick";
        customSize?: string;
        highlightBorder?: boolean;
        onClick?: (ev: Event) => void;
    }

    // TODO - add intersection observer
    let {
        url,
        size = "md",
        name,
        radius = "circle",
        highlightBorder = false,
        borderWidth = highlightBorder ? "thick" : "zero",
        customSize,
        onClick,
    }: Props = $props();
    let borderCss = $derived.by(() => {
        switch (borderWidth) {
            case "zero":
                return "";
            default:
                return `padding: var(--bw-${borderWidth});`;
        }
    });

    let sizeCss = $derived(`--size: ${customSize ? customSize : `var(--avatar-${size})`};`);
    let radiusCss = $derived(`border-radius: var(--rad-${radius});`);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class:clickable={onClick !== undefined}
    class:highlight={highlightBorder}
    class="border"
    onclick={onClick}
    style={`${sizeCss} ${radiusCss} ${borderCss}`}>
    <img
        loading="lazy"
        src={url}
        alt={name}
        class={`avatar ${size}`}
        style={`${sizeCss} ${radiusCss}`} />
</div>

<style lang="scss">
    .border {
        background: var(--background-0);
        width: var(--size);
        height: var(--size);

        &.highlight {
            background: var(--gradient);
        }

        &.clickable {
            cursor: pointer;
        }
    }

    .avatar {
        object-fit: cover;
        width: 100%;
        height: 100%;
        aspect-ratio: 1 / 1;
    }
</style>
