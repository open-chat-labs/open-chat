<script lang="ts" generics="T">
    import { Body, type ColourVarKeys, ColourVars, Container } from "component-lib";
    import type { Snippet } from "svelte";
    import Check from "svelte-material-icons/Check.svelte";

    let {
        children,
        selected,
        icon,
        onClick,
        disabled = false,
        value,
    } = $props<{
        value: T;
        children: Snippet;
        icon?: Snippet<[string]>;
        selected: boolean;
        onClick?: (val: T) => void;
        disabled?: boolean;
    }>();

    let textColour = $derived.by<ColourVarKeys>(() => {
        if (disabled) return "textSecondary";
        if (selected) return "primary";
        return "textPrimary";
    });
</script>

<Container
    onClick={disabled ? undefined : () => onClick?.(value)}
    padding={["lg", "lg", "lg", "xxl"]}
    gap={"md"}
    borderWidth={"thick"}
    borderColour={selected ? ColourVars.primary : "transparent"}
    borderRadius={"circle"}>
    {#if icon}
        {@render icon(selected ? ColourVars.primary : ColourVars.textPrimary)}
    {/if}
    <Body colour={textColour} fontWeight={"bold"}>
        {@render children()}
    </Body>
    {#if selected}
        <Check size={"1.4rem"} color={ColourVars.primary} />
    {/if}
</Container>
