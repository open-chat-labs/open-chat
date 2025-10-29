<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { publish, type ResourceKey } from "openchat-client";
    import DiamondOutline from "svelte-material-icons/DiamondOutline.svelte";
    import MulticolourText from "../MulticolourText.svelte";
    import SparkleBox from "../SparkleBox.svelte";

    interface Props {
        message?: ResourceKey;
    }

    let {
        message = i18nKey(
            "Diamond members get access to many additional features including extra storage, translation and much more. ",
        ),
    }: Props = $props();
</script>

<SparkleBox buttonText={i18nKey("Get Diamond")} onClick={() => publish("upgrade")}>
    {#snippet title()}
        <MulticolourText
            parts={[
                {
                    text: i18nKey("Upgrade to "),
                    colour: "primaryLight",
                },
                {
                    text: i18nKey("Diamond"),
                    colour: "secondary",
                },
            ]} />
    {/snippet}
    {#snippet body()}
        <MulticolourText
            parts={[
                {
                    text: message,
                    colour: "primaryLight",
                },
                {
                    text: i18nKey("Join now!"),
                    colour: "textPrimary",
                },
            ]} />
    {/snippet}
    {#snippet buttonIcon(color)}
        <DiamondOutline {color} />
    {/snippet}
</SparkleBox>
