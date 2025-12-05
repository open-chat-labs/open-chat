<script module lang="ts">
    export type ChatListFilter = "all" | "unread" | "groups" | "direct";
</script>

<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { CommonButton, Container, transition } from "component-lib";
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
    <CommonButton
        height={"fill"}
        width={selected ? { share: 1.3 } : { share: 1 }}
        onClick={() => setFilter(f)}
        mode={selected ? "active" : "default"}
        size={"small"}>
        <Translatable resourceKey={i18nKey(name)}></Translatable>
    </CommonButton>
{/snippet}

<Container
    height={{ size: "3rem" }}
    mainAxisAlignment={"spaceBetween"}
    padding={["sm", "md"]}
    gap={"sm"}>
    {@render button("all", "All")}
    {@render button("direct", "Direct")}
    {@render button("groups", "Groups")}
    {@render button("unread", "Unread")}
</Container>
