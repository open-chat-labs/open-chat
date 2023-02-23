<script lang="ts">
    import { params } from "svelte-spa-router";
    import BlogPost from "./blog/BlogPost.svelte";
    import { postsBySlug } from "./blog/posts";

    $: slug = $params ? $params["slug"] : undefined;
</script>

<div class="post">
    {#if slug !== undefined && postsBySlug[slug] !== undefined}
        <BlogPost>
            <svelte:component this={postsBySlug[slug].component} />
        </BlogPost>
    {:else}
        <div class="not-found">
            <h1 class="title">Blog post not found</h1>
            <div class="shrug">🤷‍♀️</div>
        </div>
    {/if}
</div>

<style type="text/scss">
    .post {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);

        @include mobile() {
            margin-top: 0;
        }
    }

    .not-found {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: $sp7;
        height: 30vh;

        .title {
            @include font(bold, normal, fs-200);
        }

        .shrug {
            font-size: 60px;
        }
    }
</style>
