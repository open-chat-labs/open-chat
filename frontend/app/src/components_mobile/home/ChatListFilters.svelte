<script module lang="ts">
    export type ChatListFilter = "all" | "unread" | "groups" | "direct";
</script>

<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { CommonButton, Container } from "component-lib";
    import Translatable from "../Translatable.svelte";

    interface Props {
        filter: ChatListFilter;
    }

    let { filter = $bindable("all") }: Props = $props();
</script>

{#snippet button(f: ChatListFilter, name: string)}
    <CommonButton
        width={{ kind: "fill" }}
        onClick={() => (filter = f)}
        mode={filter === f ? "active" : "default"}
        size={"small"}>
        <Translatable resourceKey={i18nKey(name)}></Translatable>
    </CommonButton>
{/snippet}

<Container mainAxisAlignment={"spaceBetween"} padding={["sm", "md"]} gap={"sm"}>
    {@render button("all", "All")}
    {@render button("unread", "Unread")}
    {@render button("groups", "Groups")}
    {@render button("direct", "Direct")}
</Container>
