<script lang="ts">
    import Headline from "./Headline.svelte";
    import BlogSummary from "./blog/BlogSummary.svelte";
</script>

<div class="blog">
    <Headline>OpenChat blog</Headline>

    <BlogSummary
        slug={"responsive_design"}
        posted={new Date()}
        title="The Importance of Responsive Web Design for Your Website" />

    <BlogSummary
        slug={"cyber_security"}
        posted={new Date()}
        title="Cybersecurity Best Practices: How to Protect Your Business from Cyber Attacks" />
</div>

<style type="text/scss">
    .blog {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);

        @include mobile() {
            margin-top: 0;
        }
    }
</style>
