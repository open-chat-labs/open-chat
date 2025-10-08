<script lang="ts">
    import { ColourVars, Label, type ColourVarKeys } from "component-lib";
    import { type Snippet } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Container from "./Container.svelte";

    interface Props {
        children?: Snippet;
        icon?: Snippet<[string]>;
        mode?: "filled" | "default" | "filter" | "rounded";
        onRemove?: () => void;
        fill?: boolean;
    }
    let { children, icon, mode = "default", onRemove, fill = false }: Props = $props();

    let iconColour = $derived(getIconColour());
    let textColour = $derived(getTextColour());
    let textColourVar = $derived(getTextColourVar());
    let bgColour = $derived(getBackgroundColour());

    function getIconColour(): string {
        switch (mode) {
            case "filled":
            case "filter":
                return ColourVars.primaryLight;
            default:
                return ColourVars.primary;
        }
    }

    function getTextColour(): ColourVarKeys {
        switch (mode) {
            case "filled":
                return "primaryLight";
            case "filter":
                return "secondaryLight";
            case "default":
                return "textSecondary";
            case "rounded":
                return "primary";
        }
    }

    function getTextColourVar(): string {
        switch (mode) {
            case "filled":
                return ColourVars.primaryLight;
            case "filter":
                return ColourVars.secondaryLight;
            case "default":
                return ColourVars.textSecondary;
            case "rounded":
                return ColourVars.primary;
        }
    }

    function getBackgroundColour(): string {
        switch (mode) {
            case "filled":
                return ColourVars.primaryMuted;
            case "filter":
                return ColourVars.secondaryMuted;
            default:
                return "transparent";
        }
    }
</script>

<Container
    supplementalClass={"chip"}
    background={bgColour}
    mainAxisAlignment={"spaceBetween"}
    crossAxisAlignment={"center"}
    width={{ kind: fill ? "fill" : "hug" }}
    gap={"sm"}
    borderColour={mode === "rounded" ? ColourVars.primary : ColourVars.textTertiary}
    borderRadius={mode === "rounded" ? "circle" : "md"}
    borderWidth={mode === "filter" || mode === "filled" ? "zero" : "thick"}
    padding={["xs", onRemove ? "md" : "lg", "xs", icon ? "md" : "lg"]}
    onClick={onRemove}>
    {#if icon}
        <span class="icon">{@render icon(iconColour)}</span>
    {/if}
    <Label colour={textColour} width={{ kind: "fill" }}>
        {@render children?.()}
    </Label>
    {#if onRemove}
        <span class="icon">
            <Close color={textColourVar} />
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
