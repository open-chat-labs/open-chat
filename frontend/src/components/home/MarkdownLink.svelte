<script lang="ts">
    import FakeMarkdownLink from "./FakeMarkdownLink.svelte";
    import { isAbsoluteUrl, synonymousUrlRegex } from "../../utils/urls";

    export let href: string | null;
    export let title: string | null;
    export let text: string;

    let target = "";

    $: {
        if (href) {
            if (synonymousUrlRegex.test(href)) {
                href = href.replace(synonymousUrlRegex, "");
                if (href === "" || href === "/") {
                    href = "/#";
                }
            } else if (isAbsoluteUrl(href)) {
                target = 'target="_blank"';
            }
        }
    }
</script>

{#if !href}
    <FakeMarkdownLink {title} {text} />
{:else}
    <a {href} {title} {target}>{text}</a>
{/if}
