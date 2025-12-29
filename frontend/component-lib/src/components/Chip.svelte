<script lang="ts">
    import {
        ColourVars,
        IconButton,
        Label,
        ButtonSmall,
        type ColourVarKeys,
        type Padding,
        type SizeMode,
    } from "component-lib";
    import { type Snippet } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Container from "./Container.svelte";

    type Mode = "filled" | "default" | "filter" | "rounded" | "unselected";

    interface Props {
        children?: Snippet;
        icon?: Snippet<[string]>;
        mode?: Mode;
        onRemove?: () => void;
        onClick?: () => void;
        fill?: boolean;
        width?: SizeMode;
    }
    let { children, icon, mode = "default", onRemove, fill, width, onClick }: Props = $props();

    const iconColours: Record<Mode, string> = {
        filled: ColourVars.primaryLight,
        filter: ColourVars.primaryLight,
        rounded: ColourVars.primary,
        default: ColourVars.primary,
        unselected: ColourVars.textSecondary,
    };

    const textColours: Record<Mode, ColourVarKeys> = {
        filled: "primaryLight",
        filter: "secondaryLight",
        rounded: "primary",
        default: "textSecondary",
        unselected: "textSecondary",
    };

    const textColourVars: Record<Mode, string> = {
        filled: ColourVars.primaryLight,
        filter: ColourVars.secondaryLight,
        rounded: ColourVars.primary,
        default: ColourVars.textSecondary,
        unselected: ColourVars.textSecondary,
    };

    const borderColours: Record<Mode, string> = {
        filled: ColourVars.primaryMuted,
        filter: ColourVars.secondaryMuted,
        rounded: ColourVars.primary,
        default: ColourVars.textTertiary,
        unselected: ColourVars.textTertiary,
    };

    const backgroundColours: Record<Mode, string> = {
        filled: ColourVars.primaryMuted,
        filter: ColourVars.secondaryMuted,
        rounded: "transparent",
        default: "transparent",
        unselected: "transparent",
    };

    const isRounded = ["rounded", "unselected"].indexOf(mode) > -1;
    const padding: Padding = isRounded ? ["sm", "zero"] : "zero";
    const height: SizeMode = {
        size: isRounded ? "1.75rem" : "2rem",
    };
</script>

<Container supplementalClass={"chip"} {padding} {onClick} width={fill ? "fill" : width ?? "hug"}>
    <Container
        {height}
        gap={"sm"}
        width={"fill"}
        background={backgroundColours[mode]}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}
        borderColour={borderColours[mode]}
        borderRadius={isRounded ? "circle" : "md"}
        borderWidth={"thick"}
        padding={["xs", onRemove ? "md" : "lg", "xs", icon ? "md" : "lg"]}>
        {#if icon}
            <span class="icon">{@render icon(iconColours[mode])}</span>
        {/if}

        {#if isRounded}
            <ButtonSmall align={"center"} colour={textColours[mode]} width={"fill"}>
                {@render children?.()}
            </ButtonSmall>
        {:else}
            <Label align={"center"} colour={textColours[mode]} width={"fill"}>
                {@render children?.()}
            </Label>
        {/if}

        {#if onRemove}
            <IconButton
                size={"sm"}
                padding={"zero"}
                onclick={(e) => {
                    e?.stopPropagation();
                    onRemove();
                }}>
                {#snippet icon()}
                    <Close color={textColourVars[mode]} />
                {/snippet}
            </IconButton>
        {/if}
    </Container>
</Container>

<style lang="scss">
    :global {
        .container.chip {
            transition: flex-grow 150ms ease-out;
            .icon svg {
                width: 1rem;
                height: 1rem;
            }
        }
    }
    .icon {
        display: flex;
    }
</style>
