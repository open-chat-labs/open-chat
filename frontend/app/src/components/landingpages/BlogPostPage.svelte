<script lang="ts">
    import BlogPost from "./blog/BlogPost.svelte";
    import { postsBySlug } from "./blog/posts";

    export let slug: string;

    $: post = postsBySlug[slug];
</script>

<div class="post">
    {#if slug !== undefined && post !== undefined}
        <BlogPost>
            <h1>{post.title}</h1>
            <div class="who_when">by {post.author}, on {post.date.toLocaleDateString()}</div>
            <svelte:component this={post.component} />
        </BlogPost>
    {:else}
        <div class="not-found">
            <h1 class="title">Blog post not found</h1>
            <div class="shrug">🤷‍♀️</div>
        </div>
    {/if}
</div>

<style lang="scss">
    .post {
        text-align: left;
        width: 100%;
        @include lp-content-padding();
        margin-top: toRem(80);

        @include mobile() {
            margin-top: 0;
        }

        h1 {
            @include font(bold, normal, fs-200);
            margin-bottom: $sp1;
        }

        .who_when {
            margin-bottom: $sp5;
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
