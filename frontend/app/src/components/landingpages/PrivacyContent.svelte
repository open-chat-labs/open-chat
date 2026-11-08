<!-- The privacy notice, from Learn's content (web/features/marketing/learn/legal/privacy.ts): the
     one copy of the text, which the web's /privacy shows too. -->
<script lang="ts">
    import { privacy } from "@src/web/features/marketing/learn/legal/privacy";
    import LegalDocContent from "./LegalDocContent.svelte";
</script>

<LegalDocContent doc={privacy} numberedHeadings />
