<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { ColourVars, Column, H2 } from "component-lib";
    import type { DiamondMembershipDuration, ResourceKey } from "openchat-client";
    import Diamond from "svelte-material-icons/DiamondOutline.svelte";
    import Lifetime from "svelte-material-icons/DiamondStone.svelte";
    import MulticolourText, { type TextPart } from "../..//MulticolourText.svelte";

    type Duration = {
        key: ResourceKey;
        kind: DiamondMembershipDuration;
    };

    interface Props {
        duration?: Duration;
        extend: boolean;
    }

    let { duration, extend }: Props = $props();

    let parts = $derived<TextPart[]>(
        duration
            ? [
                  {
                      text: i18nKey("Get "),
                      colour: "textPrimary",
                  },
                  {
                      text: duration.key,
                      colour: "primary",
                  },
                  {
                      text: i18nKey(" Diamond Membership"),
                      colour: "textPrimary",
                  },
              ]
            : [
                  {
                      text: i18nKey(extend ? "Extend " : "Select "),
                      colour: "textPrimary",
                  },
                  {
                      text: i18nKey("Diamond "),
                      colour: "primary",
                  },
                  {
                      text: i18nKey("Membership Duration"),
                      colour: "textPrimary",
                  },
              ],
    );
</script>

<Column width={{ size: "80%" }} gap={"sm"}>
    {#if duration?.kind === "lifetime"}
        <Lifetime color={ColourVars.primary} size={"4.5rem"} />
    {:else}
        <Diamond color={ColourVars.primary} size={"4.5rem"} />
    {/if}
    <H2 fontWeight={"bold"}>
        <MulticolourText {parts} />
    </H2>
</Column>
