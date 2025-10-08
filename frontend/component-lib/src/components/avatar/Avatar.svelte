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

<div
    class:highlight={highlightBorder}
    class="border"
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
    }

    .avatar {
        object-fit: cover;
        width: 100%;
        height: 100%;
        aspect-ratio: 1 / 1;
    }
</style>
