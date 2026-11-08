<!-- The terms, from Learn's content (web/features/marketing/learn/legal/terms.ts): the one copy of
     the text, which the web's /terms and the old mobile tree's sign-up show too. -->
<script lang="ts">
    import { terms } from "@src/web/features/marketing/learn/legal/terms";
    import LegalDocContent from "./LegalDocContent.svelte";
</script>

<LegalDocContent doc={terms} />
