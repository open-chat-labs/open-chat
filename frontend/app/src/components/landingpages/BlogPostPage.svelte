<script lang="ts">
    import type { SvelteComponent } from "svelte";
    import { params } from "svelte-spa-router";
    import BlogPost from "./blog/BlogPost.svelte";
    import ResponsiveDesign from "./blog/ResponsiveDesign.svelte";
    import Security from "./blog/Security.svelte";

    $: slug = $params ? $params["slug"] : undefined;
    const postsBySlug: Record<string, typeof SvelteComponent> = {
        responsive_design: ResponsiveDesign,
        cyber_security: Security,
    };
</script>

<div class="post">
    <BlogPost>
        {#if slug !== undefined && postsBySlug[slug] !== undefined}
            <svelte:component this={postsBySlug[slug]} />
        {/if}
    </BlogPost>
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
</style>
