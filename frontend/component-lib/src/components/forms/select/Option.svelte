<script lang="ts" generics="T">
    import { Body, type ColourVarKeys, ColourVars, Container, type Padding } from "component-lib";
    import type { Snippet } from "svelte";
    import Check from "svelte-material-icons/CheckboxMarkedOutline.svelte";

    let {
        children,
        selected,
        icon,
        onClick,
        disabled = false,
        value,
        padding,
    } = $props<{
        value: T;
        children: Snippet;
        icon?: Snippet<[string]>;
        selected: boolean;
        onClick?: (val: T) => void;
        disabled?: boolean;
        padding?: Padding;
    }>();

    let textColour = $derived.by<ColourVarKeys>(() => {
        if (disabled) return "textSecondary";
        if (selected) return "primary";
        return "textPrimary";
    });
</script>

<Container
    onClick={disabled ? undefined : () => onClick?.(value)}
    padding={padding ?? ["lg", "lg", "lg", "xxl"]}
    gap={"md"}
    crossAxisAlignment={"center"}
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
