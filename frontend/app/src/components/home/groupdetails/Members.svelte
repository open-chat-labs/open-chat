<script lang="ts">
    import BotInstaller from "@src/components/bots/install/BotInstaller.svelte";
    import WebhookMember from "@src/components/bots/WebhookMember.svelte";
    import {
        type BotMatch as BotMatchType,
        type CommunityIdentifier,
        type CommunitySummary,
        type EnhancedExternalBot,
        type ExternalBot,
        type FullMember,
        type GrantedBotPermissions,
        type MemberRole,
        type Member as MemberType,
        type MultiUserChat,
        type MultiUserChatIdentifier,
        type OpenChat,
        type ReadonlyMap,
        type ReadonlySet,
        type UserLookup,
        type UserSummary,
        type WebhookDetails,
        allUsersStore,
        botState,
        chatIdentifiersEqual,
        currentUserIdStore,
        LARGE_GROUP_THRESHOLD,
        ROLE_ADMIN,
        ROLE_MEMBER,
        ROLE_MODERATOR,
        ROLE_OWNER,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import Alarm from "svelte-material-icons/Alarm.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import { menuCloser } from "../../../actions/closeMenu";
    import { i18nKey } from "../../../i18n/i18n";
    import { trimLeadingAtSymbol } from "../../../utils/user";
    import BotExplorer from "../../bots/BotExplorer.svelte";
    import BotMember from "../../bots/BotMember.svelte";
    import Search from "../../Search.svelte";
    import Translatable from "../../Translatable.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import UserGroups from "../communities/details/UserGroups.svelte";
    import BlockedUser from "./BlockedUser.svelte";
    import InvitedUser from "./InvitedUser.svelte";
    import Member from "./Member.svelte";
    import MembersHeader from "./MembersHeader.svelte";
    import User from "./User.svelte";

    const MAX_SEARCH_RESULTS = 255; // irritatingly this is a nat8 in the candid
    const client = getContext<OpenChat>("client");

    interface Props {
        closeIcon: "close" | "back";
        collection: CommunitySummary | MultiUserChat;
        invited: ReadonlySet<string>;
        members: MemberType[];
        blocked: ReadonlySet<string>;
        lapsed: ReadonlySet<string>;
        installedBots: ReadonlyMap<string, GrantedBotPermissions>;
        initialUsergroup?: number | undefined;
        showHeader?: boolean;
        webhooks?: WebhookDetails[];
        onClose: () => void;
        onShowInviteUsers: () => void;
        onChangeRole?: (args: { userId: string; newRole: MemberRole; oldRole: MemberRole }) => void;
        onBlockUser?: (args: { userId: string }) => void;
        onRemoveMember?: (userId: string) => void;
        onUnblockUser: (user: UserSummary) => void;
        onCancelInvite: (userId: string) => void;
    }

    let {
        closeIcon,
        collection,
        invited,
        members,
        blocked,
        lapsed,
        installedBots,
        initialUsergroup = $bindable(undefined),
        showHeader = true,
        webhooks,
        onClose,
        onShowInviteUsers,
        onChangeRole,
        onBlockUser,
        onRemoveMember,
        onUnblockUser,
        onCancelInvite,
    }: Props = $props();

    type SelectedBot = {
        bot: BotMatchType | ExternalBot;
    };

    let userGroups: UserGroups | undefined = $state();
    let showingBotInstaller: SelectedBot | undefined = $state(undefined);
    let installingBot: BotMatchType | undefined = undefined;

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

    function matchingUsers(
        term: string,
        users: UserLookup,
        ids: ReadonlySet<string>,
        includeMe = false,
    ): UserSummary[] {
        return Array.from<string>(ids).reduce((matching, id) => {
            const user = users.get(id);
            if (
                user &&
                matchesSearch(term, user) &&
                (user.userId !== $currentUserIdStore || includeMe)
            ) {
                matching.push(user);
            }
            return matching;
        }, [] as UserSummary[]);
    }

    let searchTermEntered = $state("");
    let id = $state(collection.id);
    let membersList = $state<VirtualList<FullMember> | undefined>();
    let memberView: "members" | "blocked" | "invited" | "lapsed" = $state("members");
    let selectedTab: "users" | "groups" | "add-bots" = $state("users");

    function idsMatch(
        previous: CommunityIdentifier | MultiUserChatIdentifier,
        next: CommunityIdentifier | MultiUserChatIdentifier,
    ): boolean {
        if (previous.kind === "community" && next.kind === "community")
            return previous.communityId === next.communityId;
        if (previous.kind !== "community" && next.kind !== "community")
            return chatIdentifiersEqual(previous, next);
        return false;
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

    function webhookMatches(searchTermLower: string, webhook: WebhookDetails): boolean {
        if (searchTermLower === "") return true;
        return webhook.name.toLowerCase().includes(searchTermLower);
    }

    function getKnownUsers(userStore: UserLookup, members: MemberType[]): FullMember[] {
        const users: FullMember[] = [];
        members.forEach((m) => {
            const user = userStore.get(m.userId);
            if (user) {
                users.push({
                    ...user,
                    ...m,
                    displayName: m.displayName ?? user.displayName,
                });
            }
        });
        return users;
    }

    function compareMembers(a: FullMember, b: FullMember): number {
        return b.role - a.role;
    }

    function setView(v: "members" | "blocked" | "invited" | "lapsed"): void {
        memberView = v;
    }

    function selectTab(tab: "users" | "groups" | "add-bots") {
        selectedTab = tab;
        userGroups?.reset();
    }

    function onSearchEntered() {
        if (largeGroup && knownUsers.length < members.length && searchTerm.length > 0) {
            // let's kick off the universal usersearch to try to fill in any missing users
            // no need to process the results, they will automatically get added to the userstore and that
            // will cause the search results to be reactively recalculated
            client.searchUsers(searchTerm, MAX_SEARCH_RESULTS);
        }
        membersList?.reset();
    }

    function onBotSelected(bot: BotMatchType | ExternalBot | undefined) {
        if (bot === undefined) {
            showingBotInstaller = undefined;
            return;
        }

        if (installedBots.has(bot.id)) {
            // TODO - probably this should go to review command permissions if there are any commands
            selectTab("users");
            return;
        }

        showingBotInstaller = {
            bot,
        };
    }

    function closeInstaller(installed: boolean) {
        showingBotInstaller = undefined;
        if (installed) {
            selectTab("users");
        }
    }
    let knownUsers = $derived(getKnownUsers($allUsersStore, members));
    let largeGroup = $derived(members.length > LARGE_GROUP_THRESHOLD);
    let me = $derived(knownUsers.find((u) => u.userId === $currentUserIdStore));
    let searchTerm = $derived(trimLeadingAtSymbol(searchTermEntered));
    let searchTermLower = $derived(searchTerm.toLowerCase());
    let fullMembers = $derived(
        knownUsers
            .filter((u) => matchesSearch(searchTermLower, u) && u.userId !== $currentUserIdStore)
            .sort(compareMembers),
    );
    let blockedUsers = $derived(matchingUsers(searchTermLower, $allUsersStore, blocked, true));
    let lapsedMembers = $derived(matchingUsers(searchTermLower, $allUsersStore, lapsed, true));
    let invitedUsers = $derived(matchingUsers(searchTermLower, $allUsersStore, invited, true));
    let matchingWebhooks = $derived(
        webhooks?.filter((w) => webhookMatches(searchTermLower, w)) ?? [],
    );
    let showBlocked = $derived(blockedUsers.length > 0);
    let showInvited = $derived(invitedUsers.length > 0);
    let showLapsed = $derived(lapsedMembers.length > 0);
    let canInvite = $derived(client.canInviteUsers(collection.id));

    let bots = $derived(
        hydrateBots(installedBots, botState.externalBots).filter((b) =>
            matchesSearch(searchTermLower, b),
        ),
    );
    let canManageBots = $derived(client.canManageBots(collection.id));
    let botContainer = $derived(
        collection.kind === "channel"
            ? ({ kind: "community", communityId: collection.id.communityId } as CommunityIdentifier)
            : collection.id,
    );
    $effect(() => {
        if (!idsMatch(collection.id, id)) {
            id = collection.id;
            memberView = "members";
        }

        if (
            (memberView === "blocked" && blocked.size === 0) ||
            (memberView === "invited" && invited.size === 0)
        ) {
            memberView = "members";
        }

        if (initialUsergroup !== undefined) {
            selectedTab = "groups";
        }
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

{#if showHeader}
    <MembersHeader level={collection.level} {closeIcon} {canInvite} {onClose} {onShowInviteUsers} />
{/if}

{#if collection.kind !== "channel"}
    <div class="tabs">
        <button
            onclick={() => selectTab("users")}
            class:selected={selectedTab === "users"}
            class="tab">
            <Translatable resourceKey={i18nKey("communities.members")} />
        </button>
        {#if collection.kind === "community"}
            <button
                onclick={() => selectTab("groups")}
                class:selected={selectedTab === "groups"}
                class="tab">
                <Translatable resourceKey={i18nKey("communities.userGroups")} />
            </button>
        {/if}
        {#if canManageBots}
            <button
                onclick={() => selectTab("add-bots")}
                class:selected={selectedTab === "add-bots"}
                class="tab">
                <Translatable resourceKey={i18nKey("bots.explorer.addBots")} />
            </button>
        {/if}
    </div>
{/if}

{#if selectedTab === "users"}
    <div class="search">
        <Search
            onPerformSearch={onSearchEntered}
            searching={false}
            bind:searchTerm={searchTermEntered}
            placeholder={i18nKey("search")} />
    </div>

    {#if showBlocked || showInvited || showLapsed}
        <div class="tabs">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <button
                onclick={() => setView("members")}
                class:selected={memberView === "members"}
                class="tab sub">
                <AccountMultiple
                    size={"0.9em"}
                    viewBox={"0 -2 24 24"}
                    color={memberView === "members" ? "var(--txt)" : "var(--txt-light)"} />
                <Translatable resourceKey={i18nKey("members")} />
            </button>
            {#if showInvited}
                <button
                    onclick={() => setView("invited")}
                    class:selected={memberView === "invited"}
                    class="tab sub">
                    <AccountPlusOutline
                        size={"0.9em"}
                        viewBox={"0 -2 24 24"}
                        color={memberView === "invited" ? "var(--txt)" : "var(--txt-light)"} />
                    <Translatable resourceKey={i18nKey("invited")} />
                </button>
            {/if}

            {#if showBlocked}
                <button
                    onclick={() => setView("blocked")}
                    class:selected={memberView === "blocked"}
                    class="tab sub">
                    <Cancel
                        size={"0.9em"}
                        viewBox={"0 -2 24 24"}
                        color={memberView === "blocked" ? "var(--txt)" : "var(--txt-light)"} />
                    <Translatable resourceKey={i18nKey("blocked")} />
                </button>
            {/if}

            {#if showLapsed}
                <button
                    onclick={() => setView("lapsed")}
                    class:selected={memberView === "lapsed"}
                    class="tab sub">
                    <Alarm
                        size={"0.9em"}
                        viewBox={"0 -2 24 24"}
                        color={memberView === "lapsed" ? "var(--txt)" : "var(--txt-light)"} />
                    <Translatable resourceKey={i18nKey("access.lapsed.user")} />
                </button>
            {/if}
        </div>
    {/if}

    {#if memberView === "members"}
        {#if me !== undefined}
            <Member
                me
                member={me}
                canPromoteToOwner={false}
                canDemoteToAdmin={client.canDemote(collection.id, me.role, ROLE_ADMIN)}
                canDemoteToModerator={client.canDemote(collection.id, me.role, ROLE_MODERATOR)}
                canDemoteToMember={client.canDemote(collection.id, me.role, ROLE_MEMBER)}
                {onChangeRole} />
        {/if}

        {#if bots.length > 0}
            <h4 class="member_type_label">
                <Translatable resourceKey={i18nKey("bots.member.bots")}></Translatable>
            </h4>
            {#each bots as bot}
                <BotMember
                    {collection}
                    {bot}
                    grantedPermissions={bot.grantedPermissions}
                    canManage={canManageBots}
                    {searchTerm} />
            {/each}
        {/if}

        {#if matchingWebhooks !== undefined && matchingWebhooks.length > 0 && me?.role === ROLE_OWNER && collection.kind !== "community"}
            <h4 class="member_type_label">
                <Translatable resourceKey={i18nKey("bots.member.webhooks")}></Translatable>
            </h4>
            {#each matchingWebhooks.values() as webhook}
                <WebhookMember chat={collection} {webhook} {searchTerm} />
            {/each}
        {/if}

        {#if (bots.length > 0 || (matchingWebhooks !== undefined && matchingWebhooks.length > 0)) && fullMembers.length > 0}
            <h4 class="member_type_label">
                <Translatable resourceKey={i18nKey("bots.member.people")}></Translatable>
            </h4>
        {/if}

        <VirtualList bind:this={membersList} keyFn={(user) => user.userId} items={fullMembers}>
            {#snippet children(item)}
                <Member
                    me={false}
                    member={item}
                    canPromoteToOwner={client.canPromote(collection.id, item.role, ROLE_OWNER)}
                    canPromoteToAdmin={client.canPromote(collection.id, item.role, ROLE_ADMIN)}
                    canDemoteToAdmin={client.canDemote(collection.id, item.role, ROLE_ADMIN)}
                    canPromoteToModerator={client.canPromote(collection.id, item.role, ROLE_MODERATOR)}
                    canDemoteToModerator={client.canDemote(collection.id, item.role, ROLE_MODERATOR)}
                    canDemoteToMember={client.canDemote(collection.id, item.role, ROLE_MEMBER)}
                    canBlockUser={client.canBlockUsers(collection.id)}
                    canRemoveMember={client.canRemoveMembers(collection.id)}
                    {searchTerm}
                    {onBlockUser}
                    {onChangeRole}
                    {onRemoveMember} />
            {/snippet}
        </VirtualList>
    {:else if memberView === "blocked"}
        <div use:menuCloser class="user-list">
            {#each blockedUsers as user}
                <BlockedUser
                    me={user.userId === $currentUserIdStore}
                    {user}
                    {searchTerm}
                    canUnblockUser={client.canUnblockUsers(collection.id)}
                    {onUnblockUser} />
            {/each}
        </div>
    {:else if memberView === "invited"}
        <div use:menuCloser class="user-list">
            {#each invitedUsers as user}
                <InvitedUser
                    me={user.userId === $currentUserIdStore}
                    {user}
                    {searchTerm}
                    canUninviteUser={client.canInviteUsers(collection.id)}
                    {onCancelInvite} />
            {/each}
        </div>
    {:else if memberView === "lapsed"}
        <div use:menuCloser class="user-list">
            {#each lapsedMembers as user}
                <User me={user.userId === $currentUserIdStore} {user} {searchTerm} />
            {/each}
        </div>
    {/if}
{:else if selectedTab === "groups" && collection.kind === "community"}
    <div class="user-groups">
        <UserGroups
            bind:this={userGroups}
            bind:openedGroupId={initialUsergroup}
            community={collection} />
    </div>
{:else if selectedTab === "add-bots" && collection.kind !== "channel"}
    <div class="bot-explorer">
        <BotExplorer
            location={botContainer}
            {installingBot}
            excludeInstalled
            onSelect={onBotSelected}></BotExplorer>
    </div>
{/if}

<style lang="scss">
    :global(.member-section-selector .button-group.fill) {
        flex-wrap: nowrap;
    }
    :global(.member-section-selector button) {
        padding: $sp2 0 !important;
    }

    .user-list {
        height: 100%;
        @include nice-scrollbar();
    }

    .user-groups,
    .bot-explorer {
        padding: 0 0 $sp4 0;
        flex: auto;
    }

    .tabs {
        display: flex;
        align-items: center;
        @include font(medium, normal, fs-90);
        color: var(--txt-light);
        gap: $sp5;
        border-bottom: 1px solid var(--bd);
        cursor: pointer;
        margin: 0 $sp4 $sp5 $sp4;

        @include mobile() {
            gap: $sp4;
        }

        .tab {
            all: unset;
            padding-bottom: 10px;
            margin-bottom: -2px;
            border-bottom: 3px solid transparent;
            white-space: nowrap;
            &.selected {
                color: var(--txt);
                border-bottom: 3px solid var(--txt);

                &.sub {
                    border-bottom: 3px solid var(--accent);
                }
            }
        }
    }

    .member_type_label {
        padding: $sp2 $sp4;
        text-transform: uppercase;
        @include font(light, normal, fs-50);
        border-bottom: 1px solid var(--bd);
    }
</style>
