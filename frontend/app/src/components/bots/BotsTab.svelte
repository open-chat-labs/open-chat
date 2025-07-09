<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { botSearchState } from "@src/stores/search.svelte";
    import {
        botState,
        OpenChat,
        ROLE_OWNER,
        type BotMatch as BotMatchType,
        type CommunityIdentifier,
        type CommunitySummary,
        type EnhancedExternalBot,
        type ExternalBot,
        type FullMember,
        type GrantedBotPermissions,
        type MultiUserChat,
        type ReadonlyMap,
        type UserSummary,
        type WebhookDetails,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Search from "../Search.svelte";
    import Tabs, { type Tab } from "../Tabs.svelte";
    import BotExplorer from "./BotExplorer.svelte";
    import BotMember from "./BotMember.svelte";
    import WebhookMember from "./WebhookMember.svelte";
    import BotInstaller from "./install/BotInstaller.svelte";

    const PAGE_SIZE = 50;
    const INSTALLED = 0;
    const EXPLORE = 1;
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
    let installingBot: BotMatchType | undefined = undefined;
    let botContainer = $derived(
        collection.kind === "channel"
            ? ({ kind: "community", communityId: collection.id.communityId } as CommunityIdentifier)
            : collection.id,
    );
    let canManageBots = $derived(client.canManageBots(collection.id));
    let canAddBots = $derived(canManageBots && collection.kind !== "channel");
    let searchTerm = $derived(searchTermEntered ?? "");
    let searchTermLower = $derived(searchTerm.toLowerCase());
    let multiUserChatOwner = $derived(me?.role === ROLE_OWNER && collection.kind !== "community");
    let matchingWebhooks = $derived(
        webhooks.filter((w) => multiUserChatOwner && webhookMatches(searchTermLower ?? "", w)) ??
            [],
    );
    let bots = $derived(
        hydrateBots(installedBots, botState.externalBots).filter((b) =>
            matchesSearch(searchTermLower ?? "", b),
        ),
    );
    function webhookMatches(searchTermLower: string, webhook: WebhookDetails): boolean {
        if (searchTermLower === "") return true;
        return webhook.name.toLowerCase().includes(searchTermLower);
    }
    function matchesSearch(searchTermLower: string, user: UserSummary | ExternalBot): boolean {
        if (searchTermLower === "") return true;
        if (user.kind === "external_bot") {
            return (
                user.name.toLowerCase().includes(searchTermLower) ||
                (user.definition.description !== undefined &&
                    user.definition.description.toLocaleLowerCase().includes(searchTermLower))
            );
        }

        if (user.username === undefined) return true;
        return (
            user.username.toLowerCase().includes(searchTermLower) ||
            (user.displayName !== undefined &&
                user.displayName.toLowerCase().includes(searchTermLower))
        );
    }

    function hydrateBots(
        bots: ReadonlyMap<string, GrantedBotPermissions>,
        allBots: Map<string, ExternalBot>,
    ): EnhancedExternalBot[] {
        return [...bots.entries()].reduce((bots, [id, perm]) => {
            const bot = allBots.get(id);
            if (bot !== undefined) {
                bots.push({
                    ...bot,
                    grantedPermissions: perm,
                });
            }
            return bots;
        }, [] as EnhancedExternalBot[]);
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

    function onTabSelected() {
        onSearchEntered(true);
    }

    function onSearchEntered(reset = false) {
        if (selectedTab === EXPLORE) {
            if (reset) {
                botSearchState.reset();
            } else {
                botSearchState.nextPage();
            }
            client
                .exploreBots(
                    botSearchState.term === "" ? undefined : botSearchState.term,
                    botSearchState.index,
                    PAGE_SIZE,
                    botContainer,
                    true,
                )
                .then((results) => {
                    if (results.kind === "success") {
                        if (reset) {
                            botSearchState.results = results.matches;
                        } else {
                            botSearchState.appendResults(results.matches);
                        }
                        botSearchState.total = results.total;
                    }
                });
        }
    }

    $effect(() => {
        searchTermEntered = botSearchState.term;
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
        {#each bots as bot}
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
    </div>
{/snippet}

{#snippet exploreTab()}
    <div class="bot-explorer">
        <BotExplorer {installingBot} onSelect={onBotSelected}></BotExplorer>
    </div>
{/snippet}

<div class="search">
    <Search
        onPerformSearch={() => onSearchEntered(true)}
        searching={false}
        bind:searchTerm={botSearchState.term}
        placeholder={i18nKey("search")} />
</div>
<div class="bot-tabs">
    <Tabs {onTabSelected} bind:selectedIndex={selectedTab} nested {tabs}></Tabs>
</div>

<style lang="scss">
    .bot-tabs {
        :global(.tabs) {
            margin: 0 $sp4;
        }
    }
</style>
