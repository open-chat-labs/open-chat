<!-- The terms at sign-up, from Learn's content (web/features/marketing/learn/legal/terms.ts): the one
     copy of the text, which the web's /terms and the old desktop pages show too, rendered as the
     desktop tree's pages do (LegalDocContent, which has no colours of its own), with this tree's
     headings and copy links, and terms and meanings one under the other. -->
<script lang="ts">
    import { terms } from "@src/web/features/marketing/learn/legal/terms";
    import LegalDocContent from "../components/landingpages/LegalDocContent.svelte";
    import HashLinkTarget from "./HashLinkTarget.svelte";
</script>

<LegalDocContent doc={terms} path="/terms" linkTarget={HashLinkTarget} stacked />
