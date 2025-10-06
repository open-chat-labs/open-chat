<script lang="ts">
    import { ColourVars, Label, type ColourVarKeys } from "component-lib";
    import { type Snippet } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Container from "./Container.svelte";

    interface Props {
        children?: Snippet;
        icon?: Snippet<[string]>;
        mode?: "default" | "filter" | "rounded";
        onRemove?: () => void;
    }
    let { children, icon, mode = "default", onRemove }: Props = $props();

    let iconColour = $derived(getIconColour());
    let textColour = $derived(getTextColour());
    let textColourVar = $derived(getTextColourVar());
    let bgColour = $derived(getBackgroundColour());

    function getIconColour(): string {
        switch (mode) {
            case "filter":
                return ColourVars.primaryLight;
            default:
                return ColourVars.primary;
        }
    }

    function getTextColour(): ColourVarKeys {
        switch (mode) {
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
    width={{ kind: "hug" }}
    gap={"sm"}
    borderColour={mode === "rounded" ? ColourVars.primary : ColourVars.textTertiary}
    borderRadius={mode === "rounded" ? "circle" : "md"}
    borderWidth={mode === "filter" ? "zero" : "thick"}
    padding={["xs", onRemove ? "md" : "lg", "xs", icon ? "md" : "lg"]}
    onClick={onRemove}>
    {#if icon}
        <span class="icon">{@render icon(iconColour)}</span>
    {/if}
    <Label colour={textColour} width={{ kind: "hug" }}>
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
