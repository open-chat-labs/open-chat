<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "./Markdown.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
</script>

<ModalContent on:close>
    <div slot="header"><Translatable resourceKey={i18nKey("noAccess")} /></div>
    <div slot="body">
        <Markdown text={$_("noAccessText")} />
    </div>
</ModalContent>
