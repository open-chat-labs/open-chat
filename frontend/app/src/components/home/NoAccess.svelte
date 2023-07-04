<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "./Markdown.svelte";
</script>

<ModalContent on:close>
    <div slot="header">{$_("noAccess")}</div>
    <div slot="body">
        <Markdown text={$_("noAccessText")} />
    </div>
</ModalContent>
