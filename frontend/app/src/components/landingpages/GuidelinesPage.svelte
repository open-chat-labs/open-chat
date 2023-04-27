<script lang="ts">
    import Headline from "./Headline.svelte";
    import { scrollToSection } from "../../utils/urls";
    import { querystring } from "../../routes";
    import GuidelinesContent from "./GuidelinesContent.svelte";

    let linked: number | undefined = undefined;

    $: {
        const section = $querystring.get("section");
        if (section) {
            linked = scrollToSection(section);
        }
    }
</script>

<div class="guidelines">
    <Headline>OpenChat Guidelines</Headline>

    <GuidelinesContent {linked} />
</div>

<style type="text/scss">
    .guidelines {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);

        @include mobile() {
            margin-top: 0;
        }
    }
</style>
