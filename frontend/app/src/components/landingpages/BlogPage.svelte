<script lang="ts">
    import Headline from "./Headline.svelte";
    import BlogSummary from "./blog/BlogSummary.svelte";
    import { BlogPostInfo, postsBySlug } from "./blog/posts";

    function sortByDate(a: BlogPostInfo, b: BlogPostInfo): number {
        return a.date.getTime() - b.date.getTime();
    }
    $: posts = Object.values(postsBySlug).sort(sortByDate);
</script>

<div class="blog">
    <Headline>OpenChat blog</Headline>

    {#each posts as post}
        <BlogSummary slug={post.slug} posted={post.date} title={post.title} />
    {/each}
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
