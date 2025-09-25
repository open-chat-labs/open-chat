<script lang="ts">
    import { mobileWidth } from "openchat-client";
    import Copy from "svelte-material-icons/ContentCopy.svelte";
    import { copyToClipboard } from "../../../utils/urls";
    import Link from "../Link.svelte";

    interface Props {
        title: string;
        slug: string;
        author: string;
        posted: Date;
    }

    let { title, slug, author, posted }: Props = $props();

    let copySize = $derived($mobileWidth ? "14px" : "16px");

    function copyUrl(e: Event): void {
        e.stopPropagation();
        copyToClipboard(`${window.location.origin}/blog/${slug}`);
    }
</script>

<div class="blog-summary">
    <div class="title">
        <Link path={`blog/${slug}`}>{title}</Link>
        <div class="copy" onclick={copyUrl}>
            <Copy size={copySize} color={"var(--landing-txt)"} />
        </div>
    </div>
    <div class="date">
        {`by ${author}, on ${posted.toLocaleDateString()}`}
    </div>
</div>

<style lang="scss">
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
