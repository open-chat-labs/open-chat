<script lang="ts">
    import TocSection from "./TocSection.svelte";
    import type { Section } from "./content";

    interface Props {
        section: Section;
    }

    let { section }: Props = $props();
</script>

<h2>{section.title}</h2>
{#each section.sections as sub}
    <TocSection section={sub} />
{/each}
