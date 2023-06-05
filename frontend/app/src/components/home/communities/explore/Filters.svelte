<script lang="ts">
    import Button from "../../../Button.svelte";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import { _ } from "svelte-i18n";

    let selected = "all";
    const tags = ["all", "gaming", "crypto", "metaverse", "sport", "music", "photography"];
</script>

<ButtonGroup>
    {#each tags as tag}
        <Button on:click={() => (selected = tag)} tiny secondary={tag !== selected}
            >{$_(`communities.tags.${tag}`)}</Button>
    {/each}
</ButtonGroup>
