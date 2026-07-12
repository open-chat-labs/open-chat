<script lang="ts">
    import ModalContent from "@src/ui/ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "@src/ui/Markdown.svelte";
    import Translatable from "@src/ui/Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();
</script>

<ModalContent {onClose}>
    {#snippet header()}
        <Translatable resourceKey={i18nKey("noAccess")} />
    {/snippet}
    {#snippet body()}
        <Markdown text={$_("noAccessText")} />
    {/snippet}
</ModalContent>
