<script lang="ts">
    import { querystringStore } from "openchat-client";
    import { scrollToSection } from "../../utils/urls";
    import GuidelinesContent from "./GuidelinesContent.svelte";
    import Headline from "./Headline.svelte";

    let linked: number | undefined = $state(undefined);

    $effect(() => {
        const section = $querystringStore.get("section");
        if (section) {
            linked = scrollToSection(section);
        }
    });
</script>

<div class="guidelines">
    <Headline>OpenChat Guidelines</Headline>

    <GuidelinesContent {linked} />
</div>

<style lang="scss">
    .guidelines {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);

        @include mobile() {
            margin-top: 0;
        }
    }
</style>
