<script lang="ts">
    import Markdown from "../../home/Markdown.svelte";
    import ContentSection from "./ContentSection.svelte";
    import type { Section } from "./content";

    interface Props {
        section: Section;
    }

    let { section }: Props = $props();
</script>

<Markdown text={section.text} />
{#each section.sections as sub}
    <ContentSection section={sub} />
{/each}
