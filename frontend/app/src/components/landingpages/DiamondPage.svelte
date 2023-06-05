<script lang="ts">
    import DiamondContent from "./DiamondContent.svelte";
    import Headline from "./Headline.svelte";
</script>

<div class="diamond">
    <Headline>Diamond Features</Headline>

    <DiamondContent />
</div>

<style lang="scss">
    .diamond {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);

        @include mobile() {
            margin-top: 0;
        }
    }
</style>
