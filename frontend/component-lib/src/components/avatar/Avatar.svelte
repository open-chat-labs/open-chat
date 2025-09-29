<script lang="ts">
    import type { BorderRadiusSize } from "component-lib";

    type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "huge";

    interface Props {
        url: string;
        size?: AvatarSize;
        name?: string;
        radius?: BorderRadiusSize;
        borderWidth?: "zero" | "thin" | "thick";
    }

    // TODO - add intersection observer
    let { url, size = "md", name, radius = "circle", borderWidth = "zero" }: Props = $props();
    let borderCss = $derived.by(() => {
        switch (borderWidth) {
            case "zero":
                return "";
            case "thin":
                return "border: var(--bw-thin) solid var(--background-0);";
            case "thick":
                return "border: var(--bw-thick) solid var(--background-0);";
        }
    });
</script>

<img
    loading="lazy"
    src={url}
    alt={name}
    class={`avatar ${size}`}
    style={`--size: var(--avatar-${size}); border-radius: var(--rad-${radius}); ${borderCss}`} />

<style lang="scss">
    .avatar {
        object-fit: cover;
        width: var(--size);
        height: var(--size);
    }
</style>
