<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "@shared_components/Markdown.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    interface Props {
        onClose: () => void;
        titleKey?: string;
        textKey?: string;
    }

    let { onClose, titleKey = "noAccess", textKey = "noAccessText" }: Props = $props();
</script>

<ModalContent {onClose}>
    {#snippet header()}
        <Translatable resourceKey={i18nKey(titleKey)} />
    {/snippet}
    {#snippet body()}
        <Markdown text={$_(textKey)} />
    {/snippet}
</ModalContent>
