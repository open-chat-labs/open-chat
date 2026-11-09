<!-- A legal doc's text (Learn's content, web/features/marketing/learn/legal) with Learn's markdown
     subset as elements, never HTML: links (a site's own in a new tab), bold, and code as plain
     text. Inline only, so the element around it (and its tree's styles) sets the look. -->
<script lang="ts">
    import { inlineMarkdown } from "@openchat/ui/src/pages/inlineMarkdown";

    let { text }: { text: string } = $props();

    const external = (href: string) => /^https?:/i.test(href);
</script>

{#each inlineMarkdown(text) as part}{#if part.kind === "link"}<a
            href={part.href}
            target={external(part.href) ? "_blank" : undefined}
            rel={external(part.href) ? "noreferrer noopener" : undefined}>{part.text}</a
        >{:else if part.kind === "bold"}<strong>{part.text}</strong>{:else}{part.text}{/if}{/each}
