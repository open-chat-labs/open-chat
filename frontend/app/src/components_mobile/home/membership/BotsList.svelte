<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, BodySmall, Container, ListAction, Search } from "component-lib";
    import {
        botIsInstallable,
        botState,
        hydrateBots,
        installationLocationFrom,
        OpenChat,
        publish,
        selectedChatBotsStore,
        selectedChatWebhooksStore,
        selectedCommunityBotsStore,
        type BotInstallationLocation,
        type CommunitySummary,
        type GrantedBotPermissions,
        type MultiUserChat,
        type ReadonlyMap,
        type WebhookDetails,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Webhook from "svelte-material-icons/Webhook.svelte";
    import BotMatch from "../../bots/BotMatch.svelte";
    import BotMember from "../../bots/BotMember.svelte";
    import WebhookMember from "../../bots/WebhookMember.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        collection: MultiUserChat | CommunitySummary;
    }

    let { collection }: Props = $props();
    let installedBots = $derived.by<ReadonlyMap<string, GrantedBotPermissions>>(() => {
        switch (collection.kind) {
            case "community":
                return $selectedCommunityBotsStore;
            case "channel":
                return $selectedCommunityBotsStore;
            default:
                return $selectedChatBotsStore;
        }
    });
    let webhooks = $derived.by<WebhookDetails[]>(() => {
        switch (collection.kind) {
            case "community":
                return [];
            default:
                return [...$selectedChatWebhooksStore.values()];
        }
    });
    let canManageBots = $derived(client.canManageBots(collection.id));
    let searchTerm = $state<string>();
    let searchTermLower = $derived(searchTerm?.toLocaleLowerCase());
    let location = $derived<BotInstallationLocation>(installationLocationFrom(collection));
    let canManageWebhooks = $derived(
        collection.kind !== "community" && client.canRegisterWebhook(collection.id),
    );
    let matchingWebhooks = $derived(
        webhooks.filter((w) => canManageWebhooks && webhookMatches(searchTermLower ?? "", w)) ?? [],
    );
    let matchingInstalledBots = $derived(
        hydrateBots(installedBots, botState.externalBots).filter((b) =>
            matchesSearch(searchTermLower ?? "", [
                b.name.toLocaleLowerCase(),
                b.definition.description?.toLocaleLowerCase(),
            ]),
        ),
    );
    // we can install a bot if it's public
    // if it's private then we can only install it if it's test location = this location of if we are the bot owner
    let matchingUninstalledBots = $derived(
        [...botState.externalBots.values()].filter(
            (b) =>
                !installedBots.has(b.id) &&
                botIsInstallable(b, location) &&
                matchesSearch(searchTermLower ?? "", [
                    b.name.toLocaleLowerCase(),
                    b.definition.description?.toLocaleLowerCase(),
                ]),
        ),
    );
    function webhookMatches(searchTermLower: string, webhook: WebhookDetails): boolean {
        return matchesSearch(searchTermLower, [webhook.name.toLocaleLowerCase()]);
    }
    function matchesSearch(searchTermLower: string, things: string[]): boolean {
        if (searchTermLower === "") return true;
        return things.some(
            (t) => t !== undefined && t.toLocaleLowerCase().includes(searchTermLower),
        );
    }
</script>

<SlidingPageContent title={i18nKey("Thing bots")} subtitle={i18nKey(collection.name)}>
    <Container
        height={{ kind: "fill" }}
        gap={"xl"}
        padding={["xxl", "lg", "lg", "lg"]}
        direction={"vertical"}>
        <Search
            onClear={() => (searchTerm = undefined)}
            placeholder={"Search for bots"}
            bind:value={searchTerm}></Search>
        {#if matchingInstalledBots.length > 0}
            <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                <Body fontWeight={"bold"}>
                    <Translatable
                        resourceKey={i18nKey(`Installed bots (${matchingInstalledBots.length})`)} />
                </Body>
                {#each matchingInstalledBots as bot}
                    <BotMember
                        {collection}
                        {bot}
                        grantedPermissions={bot.grantedPermissions}
                        canManage={canManageBots}
                        {searchTerm} />
                {/each}
            </Container>
        {/if}
        {#if collection.kind !== "community"}
            <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                <Container gap={"xs"} direction={"vertical"}>
                    <Body fontWeight={"bold"}>
                        <Translatable
                            resourceKey={i18nKey(`Webhooks (${matchingWebhooks.length})`)} />
                    </Body>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                "Webhooks allow programatically sending notifications to your group on specific events.",
                            )} />
                    </BodySmall>
                </Container>
                {#if canManageWebhooks}
                    <ListAction onClick={() => publish("registerWebhook", collection)}>
                        {#snippet icon(color)}
                            <Webhook {color} />
                        {/snippet}
                        Register webhook
                    </ListAction>
                {/if}
                {#each matchingWebhooks as webhook}
                    <WebhookMember
                        chat={collection}
                        {webhook}
                        {searchTerm}
                        canManage={canManageWebhooks} />
                {/each}
            </Container>
        {/if}
        <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
            <Body fontWeight={"bold"}>
                <Translatable
                    resourceKey={i18nKey(`Available bots (${matchingUninstalledBots.length})`)} />
            </Body>
            {#each matchingUninstalledBots as bot}
                <BotMatch
                    {bot}
                    {searchTerm}
                    onSelect={(bot) => publish("showBot", { bot, collection })} />
            {/each}
        </Container>
    </Container>
</SlidingPageContent>
