<script lang="ts">
    import { Column, Sheet, Title } from "component-lib";
    import { type ResourceKey } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { interpolate } from "../i18n/i18n";
    import AlertBox from "./AlertBox.svelte";
    import Markdown from "./home/Markdown.svelte";
    import Translatable from "./Translatable.svelte";

    interface Props {
        title: ResourceKey;
        warning: ResourceKey;
        onClose: () => void;
    }

    let { onClose, title, warning }: Props = $props();
</script>

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <Title fontWeight={"bold"}>
            <Translatable resourceKey={title}></Translatable>
        </Title>
        <AlertBox>
            <Markdown text={interpolate($_, warning)} />
        </AlertBox>
    </Column>
</Sheet>
