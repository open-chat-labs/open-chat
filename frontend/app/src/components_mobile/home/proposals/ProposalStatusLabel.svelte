<script lang="ts">
    import { Body, Row, type ColourVarKeys } from "component-lib";
    import { type Snippet } from "svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    type Content =
        | {
              kind: "resourceKey";
              key: string;
          }
        | {
              kind: "value";
              value: string;
          };

    interface Props {
        content: Content;
        icon?: Snippet;
        bgColor?: string;
        borderColor?: string;
        textColor?: ColourVarKeys;
    }

    let { content, icon, bgColor, borderColor, textColor = "textPrimary" }: Props = $props();
</script>

<Row
    gap="xs"
    width="hug"
    height={{ size: "2rem" }}
    borderRadius="md"
    padding={["xxs", "sm"]}
    backgroundColor={bgColor}
    borderColour={borderColor}
    borderWidth={borderColor ? "thick" : "zero"}
    crossAxisAlignment="center">
    <Body width="hug" colour={textColor}>
        {#if content.kind === "resourceKey"}
            <Translatable resourceKey={i18nKey(content.key)} />
        {:else}
            {content.value}
        {/if}
    </Body>
    {#if icon}
        {@render icon()}
    {/if}
</Row>
