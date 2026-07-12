<script lang="ts">
    import { ColourVars, defaultBackgroundGradient, Row } from "component-lib";
    import type { Snippet } from "svelte";
    import Check from "svelte-material-icons/CheckBold.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";

    interface Props {
        satisfied: boolean;
        satisfiable: boolean;
        children: Snippet;
        onClick?: () => void;
    }

    let { satisfied, satisfiable, onClick, children }: Props = $props();

    let borderColour = $derived.by(() => {
        if (satisfied) {
            return defaultBackgroundGradient;
        } else if (!satisfiable) {
            return ColourVars.error;
        } else {
            return ColourVars.background2;
        }
    });
</script>

<Row borderRadius={"md"} padding={"xxs"} background={borderColour}>
    <Row
        onClick={satisfied ? undefined : onClick}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}
        borderRadius={"md"}
        minHeight={"4rem"}
        gap={"md"}
        background={satisfied ? ColourVars.background0 : ColourVars.background2}
        padding={["md", "lg"]}>
        {@render children()}
        {#if satisfied}
            <Check color={ColourVars.success} size={"1rem"} />
        {:else if onClick}
            <ChevronRight color={ColourVars.primary} size={"1.5rem"} />
        {/if}
    </Row>
</Row>
