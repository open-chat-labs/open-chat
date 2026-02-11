<script module lang="ts">
    export type Option = {
        id: string;
        label: string;
    };
</script>

<script lang="ts">
    import { Container, transition, Chip } from "component-lib";

    interface Props {
        options: Option[];
        selected: string;
    }

    let { options, selected = $bindable() }: Props = $props();

    function selectOption(id: string) {
        transition(["fade"], () => {
            selected = id;
        });
    }
</script>

<!-- Same snippet is used in ChatListFilters -->
{#snippet button({ id, label }: Option)}
    {@const isSelected = selected === id}
    <Chip
        width={isSelected ? { share: 1.3 } : { share: 1 }}
        mode={isSelected ? "rounded" : "unselected"}
        onClick={() => selectOption(id)}>
        {label}
    </Chip>
{/snippet}

<Container mainAxisAlignment={"spaceBetween"} gap={"sm"} padding={["zero", "lg"]}>
    {#each options as opt}
        {@render button(opt)}
    {/each}
</Container>
