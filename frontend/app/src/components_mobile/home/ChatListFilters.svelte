<script module lang="ts">
    export type ChatListFilter = "all" | "unread" | "groups" | "direct";
</script>

<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Container, transition, Chip } from "component-lib";
    import Translatable from "../Translatable.svelte";

    interface Props {
        filter: ChatListFilter;
    }

    let { filter = $bindable("all") }: Props = $props();

    function setFilter(f: ChatListFilter) {
        transition(["fade"], () => {
            filter = f;
        });
    }
</script>

{#snippet button(f: ChatListFilter, name: string)}
    {@const selected = filter === f}
    <Chip
        width={selected ? { share: 1.3 } : { share: 1 }}
        mode={selected ? "rounded" : "unselected"}
        onClick={() => setFilter(f)}>
        <Translatable resourceKey={i18nKey(name)}></Translatable>
    </Chip>
{/snippet}

<Container mainAxisAlignment={"spaceBetween"} padding={["zero", "lg"]} gap={"sm"}>
    {@render button("all", "All")}
    {@render button("direct", "Direct")}
    {@render button("groups", "Groups")}
    {@render button("unread", "Unread")}
</Container>
