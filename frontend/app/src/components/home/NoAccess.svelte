<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "./Markdown.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

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
