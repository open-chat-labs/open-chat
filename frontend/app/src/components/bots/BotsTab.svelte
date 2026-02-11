<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        botIsInstallable,
        botState,
        hydrateBots,
        installationLocationFrom,
        OpenChat,
        ROLE_OWNER,
        type BotInstallationLocation,
        type BotMatch as BotMatchType,
        type CommunityIdentifier,
        type CommunitySummary,
        type ExternalBot,
        type FullMember,
        type GrantedBotPermissions,
        type MultiUserChat,
        type ReadonlyMap,
        type WebhookDetails,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Search from "../Search.svelte";
    import Tabs, { type Tab } from "../Tabs.svelte";
    import Translatable from "../Translatable.svelte";
    import BotMember from "./BotMember.svelte";
    import WebhookMember from "./WebhookMember.svelte";
    import BotInstaller from "./install/BotInstaller.svelte";
    import BotProperties from "./install/BotProperties.svelte";

    const INSTALLED = 0;
    const client = getContext<OpenChat>("client");

    type SelectedBot = {
        bot: BotMatchType | ExternalBot;
    };

    interface Props {
        searchTermEntered?: string;
        installedBots: ReadonlyMap<string, GrantedBotPermissions>;
        webhooks?: WebhookDetails[];
        me?: FullMember;
        collection: CommunitySummary | MultiUserChat;
    }

    let {
        installedBots,
        webhooks = [],
        me,
        collection,
        searchTermEntered = $bindable(),
    }: Props = $props();

    let selectedTab = $state(0);
    let showingBotInstaller: SelectedBot | undefined = $state(undefined);
    let installingBot: ExternalBot | undefined = undefined;
    let botContainer = $derived(
        collection.kind === "channel"
            ? ({ kind: "community", communityId: collection.id.communityId } as CommunityIdentifier)
            : collection.id,
    );
    let location = $derived<BotInstallationLocation>(installationLocationFrom(collection));
    let canManageBots = $derived(client.canManageBots(collection.id));
    let canAddBots = $derived(canManageBots && collection.kind !== "channel");
    let searchTerm = $derived(searchTermEntered ?? "");
    let searchTermLower = $derived(searchTerm.toLowerCase());
    let multiUserChatOwner = $derived(me?.role === ROLE_OWNER && collection.kind !== "community");
    let matchingWebhooks = $derived(
        webhooks.filter((w) => multiUserChatOwner && webhookMatches(searchTermLower ?? "", w)) ??
            [],
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

    let numberOfInstalledBots = $derived(matchingInstalledBots.length + matchingWebhooks.length);

    function webhookMatches(searchTermLower: string, webhook: WebhookDetails): boolean {
        return matchesSearch(searchTermLower, [webhook.name.toLocaleLowerCase()]);
    }
    function matchesSearch(searchTermLower: string, things: string[]): boolean {
        if (searchTermLower === "") return true;
        return things.some((t) => t !== undefined && t.toLocaleLowerCase().includes(searchTerm));
    }

    function onBotSelected(bot: BotMatchType | ExternalBot | undefined) {
        if (bot === undefined) {
            showingBotInstaller = undefined;
            return;
        }

        if (installedBots.has(bot.id)) {
            selectedTab = INSTALLED;
            return;
        }

        showingBotInstaller = {
            bot,
        };
    }

    function closeInstaller(installed: boolean) {
        showingBotInstaller = undefined;
        if (installed) {
            selectedTab = INSTALLED;
        }
    }

    const tabs: Tab[] = $derived.by(() => {
        const t: Tab[] = [
            {
                title: i18nKey("bots.member.installed"),
                snippet: installedTab,
            },
        ];
        if (canAddBots) {
            t.push({
                title: i18nKey("bots.member.explore"),
                snippet: exploreTab,
            });
        }
        return t;
    });
</script>

{#if showingBotInstaller}
    <BotInstaller
        location={botContainer}
        level={collection.level}
        {installedBots}
        onClose={closeInstaller}
        bot={showingBotInstaller.bot} />
{/if}

{#snippet installedTab()}
    <div class="bots-list">
        {#if numberOfInstalledBots === 0}
            <div class="no-result">
                <Translatable resourceKey={i18nKey("bots.member.notfound")}></Translatable>
            </div>
        {:else}
            {#each matchingInstalledBots as bot}
                <BotMember
                    {collection}
                    {bot}
                    grantedPermissions={bot.grantedPermissions}
                    canManage={canManageBots}
                    {searchTerm} />
            {/each}
            {#if collection.kind !== "community"}
                {#each matchingWebhooks.values() as webhook}
                    <WebhookMember chat={collection} {webhook} {searchTerm} />
                {/each}
            {/if}
        {/if}
    </div>
{/snippet}

{#snippet exploreTab()}
    <div class="bot-explorer">
        {#if matchingUninstalledBots.length === 0}
            <div class="no-result">
                <Translatable resourceKey={i18nKey("bots.member.notfound")}></Translatable>
            </div>
        {:else}
            {#each matchingUninstalledBots as bot}
                <BotProperties
                    showAvatar
                    padded
                    installing={bot === installingBot}
                    onClick={onBotSelected}
                    {bot} />
            {/each}
        {/if}
    </div>
{/snippet}

<div class="search">
    <Search searching={false} bind:searchTerm={searchTermEntered} placeholder={i18nKey("search")} />
</div>
<div class="bot-tabs">
    <Tabs bind:selectedIndex={selectedTab} nested {tabs}></Tabs>
</div>

<style lang="scss">
    .bot-tabs {
        :global(.tabs) {
            margin: 0 $sp4;
        }
        overflow: auto;
    }

    .no-result {
        padding: $sp4;
        color: var(--txt-light);
        @include font(light, normal, fs-90);
    }
</style>
