<script lang="ts">
    import { querystringStore } from "@client";
    import { scrollToSection } from "../../utils/urls";
    import Headline from "./Headline.svelte";
    import PrivacyContent from "./PrivacyContent.svelte";

    $effect(() => {
        const section = $querystringStore.get("section");
        if (section) {
            scrollToSection(section);
        }
    });
</script>

<div class="privacy">
    <Headline>OpenChat Privacy Notice</Headline>

    <PrivacyContent />
</div>

<style lang="scss">
    .privacy {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);

        @include mobile() {
            margin-top: 0;
        }
    }
</style>
