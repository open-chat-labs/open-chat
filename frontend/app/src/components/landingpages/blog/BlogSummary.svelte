<script lang="ts">
    import Link from "../Link.svelte";
    import Copy from "svelte-material-icons/ContentCopy.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { copyToClipboard } from "../../../utils/urls";

    export let title: string;
    export let slug: string;
    export let posted: Date;

    $: copySize = $mobileWidth ? "14px" : "16px";

    function copyUrl(): void {
        copyToClipboard(`${window.location.origin}/blog/${slug}`);
    }
</script>

<div class="blog-summary">
    <div class="title">
        <Link path={`blog/${slug}`}>{title}</Link>
        <div class="copy" on:click|stopPropagation={copyUrl}>
            <Copy size={copySize} color={"var(--landing-txt)"} />
        </div>
    </div>
    <div class="date">
        {`Posted on: ${posted.toLocaleDateString()}`}
    </div>
</div>

<style type="text/scss">
    .blog-summary {
        padding-bottom: $sp5;
        border-bottom: 1px solid var(--landing-bd);
        margin-bottom: $sp6;
    }
    .date {
        @include font(book, normal, fs-100, 28);
        color: var(--landing-txt-light);
    }
    .title {
        @include font(bold, normal, fs-140);
        margin-bottom: $sp3;
        flex: auto;
        display: flex;
        align-items: center;
        gap: $sp3;

        .copy {
            cursor: pointer;

            opacity: 0;
            transition: opacity 250ms ease-in-out;
        }

        &:hover .copy {
            opacity: 1;
        }
    }
</style>
