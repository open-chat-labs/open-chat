<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, Container, Search } from "component-lib";
    import {
        allUsersStore,
        botState,
        OpenChat,
        publish,
        type BotInstallationLocation,
        type ChatSummary,
        type CommunitySummary,
    } from "openchat-client";
    import { getContext } from "svelte";
    import BotMatch from "../../bots/BotMatch.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        collection: ChatSummary | CommunitySummary;
    }

    let { collection }: Props = $props();
    let canManageBots = $derived(client.canManageBots(collection.id));
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
    let allBots = $derived([...botState.externalBots.values()]);
    let matchingBots = $derived(
        allBots.filter(
            (b) =>
                searchTermLower === undefined ||
                searchTermLower === "" ||
                b.name.toLocaleLowerCase().includes(searchTermLower) ||
                b.definition.description.toLocaleLowerCase().includes(searchTermLower),
        ),
    );
</script>

<SlidingPageContent title={i18nKey("Thing bots")} subtitle={i18nKey(name)}>
    <Container height={{ kind: "fill" }} mainAxisAlignment={"spaceBetween"} direction={"vertical"}>
        <Container
            height={{ kind: "fill" }}
            gap={"xl"}
            padding={["xxl", "lg", "lg", "lg"]}
            direction={"vertical"}>
            <Search
                onClear={() => (searchTerm = undefined)}
                placeholder={"Search for bots"}
                bind:value={searchTerm}></Search>
            <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey(`Available bots (${allBots.length})`)} />
                </Body>
                {#each matchingBots as bot}
                    <BotMatch {bot} {searchTerm} onSelect={(bot) => publish("showBot", bot)} />
                {/each}
            </Container>
            <div>installed bots</div>
            <div>installed webhooks (if chat)</div>
            <div>recommended bots?</div>
        </Container>
    </Container>
</SlidingPageContent>
