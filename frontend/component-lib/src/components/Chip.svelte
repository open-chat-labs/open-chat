<script lang="ts">
    import { ColourVars, Label, type ColourVarKeys } from "component-lib";
    import { type Snippet } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Container from "./Container.svelte";

    type Mode = "filled" | "default" | "filter" | "rounded";

    interface Props {
        children?: Snippet;
        icon?: Snippet<[string]>;
        mode?: Mode;
        onRemove?: () => void;
        onClick?: () => void;
        fill?: boolean;
    }
    let { children, icon, mode = "default", onRemove, fill = false, onClick }: Props = $props();

    const iconColours: Record<Mode, string> = {
        filled: ColourVars.primaryLight,
        filter: ColourVars.primaryLight,
        rounded: ColourVars.primary,
        default: ColourVars.primary,
    };

    const textColours: Record<Mode, ColourVarKeys> = {
        filled: "primaryLight",
        filter: "secondaryLight",
        rounded: "primary",
        default: "textSecondary",
    };

    const textColourVars: Record<Mode, string> = {
        filled: ColourVars.primaryLight,
        filter: ColourVars.secondaryLight,
        rounded: ColourVars.primary,
        default: ColourVars.textSecondary,
    };

    const borderColours: Record<Mode, string> = {
        filled: ColourVars.primaryMuted,
        filter: ColourVars.secondaryMuted,
        rounded: ColourVars.primary,
        default: ColourVars.textTertiary,
    };

    const backgroundColours: Record<Mode, string> = {
        filled: ColourVars.primaryMuted,
        filter: ColourVars.secondaryMuted,
        rounded: "transparent",
        default: "transparent",
    };
</script>

<Container
    supplementalClass={"chip"}
    background={backgroundColours[mode]}
    mainAxisAlignment={"spaceBetween"}
    crossAxisAlignment={"center"}
    width={{ kind: fill ? "fill" : "hug" }}
    gap={"sm"}
    borderColour={borderColours[mode]}
    borderRadius={mode === "rounded" ? "circle" : "md"}
    borderWidth={"thick"}
    padding={["xs", onRemove ? "md" : "lg", "xs", icon ? "md" : "lg"]}
    onClick={onRemove ?? onClick}>
    {#if icon}
        <span class="icon">{@render icon(iconColours[mode])}</span>
    {/if}
    <Label colour={textColours[mode]} width={{ kind: "fill" }}>
        {@render children?.()}
    </Label>
    {#if onRemove}
        <span class="icon">
            <Close color={textColourVars[mode]} />
        </span>
    {/if}
</Container>

<style lang="scss">
    :global(.chip .icon svg) {
        width: 1rem;
        height: 1rem;
    }

    .icon {
        display: flex;
    }
</style>
