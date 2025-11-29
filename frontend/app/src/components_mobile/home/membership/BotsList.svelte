<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Container, Search } from "component-lib";
    import {
        allUsersStore,
        type BotInstallationLocation,
        type ChatSummary,
        type CommunitySummary,
    } from "openchat-client";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    interface Props {
        collection: ChatSummary | CommunitySummary;
    }

    let { collection }: Props = $props();
    let searchTerm = $state<string>();
    let searchTermLower = $derived(searchTerm?.toLocaleLowerCase());
    let location = $derived.by<BotInstallationLocation>(() => {
        switch (collection.kind) {
            case "channel":
                return { kind: "community", communityId: collection.id.communityId };
            default:
                return collection.id;
        }
    });
    let name = $derived.by(() => {
        switch (collection.kind) {
            case "direct_chat":
                return $allUsersStore.get(collection.them.userId)?.username ?? "Direct chat";
            default:
                return collection.name;
        }
    });

    // TODO - there's no need to use the client.exploreBots here - just use botState.externalBots
</script>

<SlidingPageContent title={i18nKey("Thing bots")} subtitle={i18nKey(name)}>
    <Container height={{ kind: "fill" }} mainAxisAlignment={"spaceBetween"} direction={"vertical"}>
        <Container
            height={{ kind: "fill" }}
            gap={"lg"}
            padding={["xxl", "lg", "lg", "lg"]}
            direction={"vertical"}>
            <pre>{JSON.stringify(location, null, 4)}</pre>
            <pre>{searchTermLower}</pre>
            <Search placeholder={"Search for bots"} bind:value={searchTerm}></Search>
            <div>Search results</div>
            <div>installed bots</div>
            <div>installed webhooks (if chat)</div>
            <div>recommended bots?</div>
        </Container>
    </Container>
</SlidingPageContent>
