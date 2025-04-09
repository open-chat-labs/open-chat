<script lang="ts">
    import { pathState } from "openchat-client";
    import { scrollToSection } from "../../utils/urls";
    import Headline from "./Headline.svelte";
    import TermsContent from "./TermsContent.svelte";

    $effect(() => {
        const section = pathState.querystring.get("section");
        if (section) {
            scrollToSection(section);
        }
    });
</script>

<div class="terms">
    <Headline>OpenChat Terms and Conditions</Headline>

    <TermsContent />
</div>

<style lang="scss">
    .terms {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);

        @include mobile() {
            margin-top: 0;
        }
    }
</style>
