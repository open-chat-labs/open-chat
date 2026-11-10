import { i18nKey } from "@src/i18n/i18n";
import { reactiveValue } from "@src/utils/reactiveValue";
import {
    currentUserIdStore,
    FIND_MEMBERS_DELAY_MS,
    inviteLinkUrl,
    memberActions,
    roleChangeFailureMessage,
    selectedChatBlockedUsersStore,
    selectedChatBotsStore,
    selectedChatInvitedUsersStore,
    selectedChatLapsedMembersStore,
    selectedChatMembersStore,
    selectedChatWebhooksStore,
    selectedCommunityBlockedUsersStore,
    selectedCommunityBotsStore,
    selectedCommunityInvitedUsersStore,
    selectedCommunityLapsedMembersStore,
    selectedCommunityMembersStore,
    selectedCommunitySummaryStore,
    type ChannelIdentifier,
    type CommunitySummary,
    type GrantedBotPermissions,
    type InviteLink,
    type InviteLinkOutcome,
    type Member,
    type MemberActions,
    type MemberRole,
    type MessageFormatter,
    type MultiUserChat,
    type Level,
    type OpenChat,
    type ReadonlyMap,
    type ReadonlySet,
    type ResourceKey,
    type UserOrUserGroup,
    type UserSummary,
    type WebhookDetails,
} from "@client";
import { pickable, type InviteWay } from "./invitePeople";

// A community has no webhooks
const noWebhooks: ReadonlyMap<string, WebhookDetails> = new Map();

// irritatingly this is a nat8 in the candid
const MAX_SEARCH_RESULTS = 255;

/** What a member action did, for the view to show: a success may have something to say, a failure always does */
export type MemberActionOutcome =
    | { kind: "success"; message?: ResourceKey }
    | { kind: "failed"; message: ResourceKey };

const succeeded: MemberActionOutcome = { kind: "success" };

const ids = (u: UserSummary): string => u.userId;

/**
 * What sending the picks did (`sendPicked`): every one sent (`added` to the channel, `invited`);
 * some sent and the others still picked, for `message`'s reason; or none sent, for `message`'s.
 */
export type SendPicksOutcome =
    | { kind: "sent"; added: UserSummary[]; invited: UserSummary[] }
    | { kind: "partly_sent"; added: UserSummary[]; invited: UserSummary[]; message: ResourceKey }
    | { kind: "failed"; message: ResourceKey }
    /** Everyone picked had joined, been invited or become uninvitable since: nothing was sent. */
    | { kind: "none_left" };

/** Loading the invite link: not asked for yet, on its way, failed, or in (`inviteLink`). */
export type InviteLinkLoad =
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "failed" }
    | { kind: "loaded"; link: InviteLink };

/** What adding to a channel did: those now in it, and why the others aren't, if any aren't. */
type AddedToChannel = { added: string[]; failure: ResourceKey | undefined };

function outcome(success: boolean, succeededKey: string, failedKey: string): MemberActionOutcome {
    return success
        ? { kind: "success", message: i18nKey(succeededKey) }
        : { kind: "failed", message: i18nKey(failedKey) };
}

/**
 * People to invite to a group, channel or community at `level`, as both old invite pages searched:
 * the community's members, then everyone else when the viewer may invite to the community. Never
 * rejects: a search that fails (a member lookup that throws) finds nobody, so a search's "searching"
 * always ends.
 */
export async function searchToInvite(
    client: OpenChat,
    level: Level,
    term: string,
): Promise<[UserSummary[], UserSummary[]]> {
    const community = selectedCommunitySummaryStore.value;
    try {
        return await client.searchUsersForInvite(
            term,
            20,
            level,
            false,
            community !== undefined && client.canInviteUsers(community.id),
        );
    } catch (err) {
        console.warn("Unable to search for people to invite", err);
        return [[], []];
    }
}

export class MemberManagement {
    #usersToAddOrInvite = $state<UserSummary[]>([]);
    #inviting = $state(false);
    // Read through `reactiveValue`, so the stores are only subscribed to while a page renders them
    #members: () => ReadonlyMap<string, Member>;
    #lapsed: () => ReadonlySet<string>;
    #blocked: () => ReadonlySet<string>;
    #invited: () => ReadonlySet<string>;
    #bots: () => ReadonlyMap<string, GrantedBotPermissions>;
    #webhooks: () => ReadonlyMap<string, WebhookDetails>;
    #togglingSharingLink = $state(false);
    #inviteLinkLoad = $state<InviteLinkLoad>({ kind: "idle" });
    #confirmingResetLink = $state(false);

    constructor(
        private client: OpenChat,
        private collection: MultiUserChat | CommunitySummary,
    ) {
        const membersStore =
            collection.kind === "community"
                ? selectedCommunityMembersStore
                : selectedChatMembersStore;

        const lapsedStore =
            collection.kind === "community"
                ? selectedCommunityLapsedMembersStore
                : selectedChatLapsedMembersStore;

        const blockedStore =
            collection.kind === "community"
                ? selectedCommunityBlockedUsersStore
                : selectedChatBlockedUsersStore;

        const invitedStore =
            collection.kind === "community"
                ? selectedCommunityInvitedUsersStore
                : selectedChatInvitedUsersStore;

        const botsStore =
            collection.kind === "community" || collection.kind === "channel"
                ? selectedCommunityBotsStore
                : selectedChatBotsStore;

        this.#members = reactiveValue(membersStore);
        this.#lapsed = reactiveValue(lapsedStore);
        this.#blocked = reactiveValue(blockedStore);
        this.#invited = reactiveValue(invitedStore);
        this.#bots = reactiveValue(botsStore);
        this.#webhooks =
            collection.kind === "community"
                ? () => noWebhooks
                : reactiveValue(selectedChatWebhooksStore);
    }

    get inviting() {
        return this.#inviting;
    }

    get confirmingResetLink() {
        return this.#confirmingResetLink;
    }

    get togglingSharingLink() {
        return this.#togglingSharingLink;
    }

    /** The link, undefined until it has loaded. */
    get inviteLink(): InviteLink | undefined {
        return this.#inviteLinkLoad.kind === "loaded" ? this.#inviteLinkLoad.link : undefined;
    }

    /** Where loading the link (`initialiseSharing`) is. */
    get inviteLinkLoad(): InviteLinkLoad {
        return this.#inviteLinkLoad;
    }

    get invited() {
        return this.#invited();
    }

    get blocked() {
        return this.#blocked();
    }

    get lapsed() {
        return this.#lapsed();
    }

    get members() {
        return this.#members();
    }

    get bots() {
        return this.#bots();
    }

    get webhooks() {
        return this.#webhooks();
    }

    get level() {
        return this.collection.level;
    }

    get usersToAddOrInvite() {
        return this.#usersToAddOrInvite;
    }

    deleteInvited(user: UserOrUserGroup): void {
        if (user.kind !== "user") return;
        this.#usersToAddOrInvite = this.#usersToAddOrInvite.filter((m) => m.userId !== user.userId);
    }

    addInvited(user: UserSummary): void {
        const u = this.#usersToAddOrInvite.find((u) => u.userId === user.userId);
        if (u === undefined) {
            this.#usersToAddOrInvite.push(user);
        }
    }

    isPicked(userId: string): boolean {
        return this.#usersToAddOrInvite.some((u) => u.userId === userId);
    }

    /** Picks someone to add or invite, or lets them go if they're picked. */
    togglePicked(user: UserSummary): void {
        if (this.isPicked(user.userId)) this.#dropPicked([user.userId]);
        else this.#usersToAddOrInvite.push(user);
    }

    async confirmResetLinkResponse(yes: boolean): Promise<MemberActionOutcome> {
        try {
            return yes
                ? this.#applyInviteLink(await this.client.resetInviteLink(this.collection))
                : succeeded;
        } finally {
            this.#confirmingResetLink = false;
        }
    }

    confirmResetLink() {
        this.#confirmingResetLink = true;
    }

    async blockUser(userId: string): Promise<MemberActionOutcome> {
        const success =
            this.collection.kind === "community"
                ? await this.client.blockCommunityUser(this.collection.id, userId)
                : await this.client.blockUser(this.collection.id, userId);
        return outcome(success, "blockUserSucceeded", "blockUserFailed");
    }

    async unblockUser(userId: string): Promise<MemberActionOutcome> {
        const success =
            this.collection.kind === "community"
                ? await this.client.unblockCommunityUser(this.collection.id, userId)
                : await this.client.unblockUser(this.collection.id, userId);
        return outcome(success, "unblockUserSucceeded", "unblockUserFailed");
    }

    async changeRole(
        args: { userId: string; newRole: MemberRole; oldRole: MemberRole },
        formatter: MessageFormatter,
    ): Promise<MemberActionOutcome> {
        const { userId, newRole, oldRole } = args;
        const success =
            this.collection.kind === "community"
                ? await this.client.changeCommunityRole(
                      this.collection.id,
                      userId,
                      newRole,
                      oldRole,
                  )
                : await this.client.changeRole(this.collection.id, userId, newRole, oldRole);
        return success
            ? succeeded
            : { kind: "failed", message: roleChangeFailureMessage(newRole, oldRole, formatter) };
    }

    async removeMember(userId: string): Promise<MemberActionOutcome> {
        try {
            const resp =
                this.collection.kind === "community"
                    ? await this.client.removeCommunityMember(this.collection.id, userId)
                    : await this.client.removeMember(this.collection.id, userId);
            if (resp.kind === "success") return succeeded;
        } catch (err) {
            this.client.logError("Unable to remove member", err);
        }
        return { kind: "failed", message: i18nKey("removeMemberFailed") };
    }

    async cancelInvite(userId: string): Promise<MemberActionOutcome> {
        const success = await this.client.cancelInvites(this.collection.id, [userId]);
        return outcome(success, "cancelInviteSucceeded", "cancelInviteFailed");
    }

    /**
     * Searches for members matching `searchTerm` if not every member, or not every member's display
     * name in the community, is held. Those found are then held, so will be in the search results.
     * Waits for two characters and a pause in typing. Returns a function that cancels the search.
     */
    findMembers(searchTerm: string): () => void {
        if (searchTerm.length < 2 || !this.client.shouldSearchForMembers(this.collection.id)) {
            return () => undefined;
        }
        const timer = setTimeout(
            () => this.client.findMembers(this.collection.id, searchTerm, MAX_SEARCH_RESULTS),
            FIND_MEMBERS_DELAY_MS,
        );
        return () => clearTimeout(timer);
    }

    /** Adds `userIds` (by default the users picked here) to the channel. */
    async addUsers(
        userIds: string[] = this.#usersToAddOrInvite.map((u) => u.userId),
    ): Promise<MemberActionOutcome> {
        this.#inviting = true;
        try {
            const { added, failure } = await this.#addToChannel(userIds);
            if (failure === undefined) return succeeded;
            // a partial success has its own message
            return added.length > 0
                ? { kind: "success", message: failure }
                : { kind: "failed", message: failure };
        } finally {
            this.#inviting = false;
        }
    }

    // Adds the users to the channel: those in it after (added, or found to be in it already), and
    // why the others aren't
    async #addToChannel(userIds: string[]): Promise<AddedToChannel> {
        const failed: AddedToChannel = { added: [], failure: i18nKey("group.addMembersFailed") };
        if (this.collection.kind !== "channel") return failed;
        try {
            const resp = await this.client.addMembersToChannel(
                this.collection.id as ChannelIdentifier,
                userIds,
            );
            switch (resp.kind) {
                case "success":
                    return { added: userIds, failure: undefined };
                case "add_to_channel_partial_success":
                    return {
                        added: [...resp.usersAdded, ...resp.usersAlreadyInChannel],
                        failure: i18nKey("group.addMembersPartialSuccess"),
                    };
                default:
                    return failed;
            }
        } catch {
            return failed;
        }
    }

    /** Invites `userIds` (by default the users picked here). */
    async inviteUsers(
        userIds: string[] = this.#usersToAddOrInvite.map((u) => u.userId),
    ): Promise<MemberActionOutcome> {
        if (userIds.length === 0) return succeeded;

        this.#inviting = true;
        try {
            if (!(await this.#invite(userIds)))
                return { kind: "failed", message: this.#inviteFailed() };
            return this.collection.public
                ? { kind: "success", message: i18nKey("group.usersInvited") }
                : succeeded;
        } finally {
            this.#inviting = false;
        }
    }

    // Invites the users; those sent leave the picks (anyone picked while it was on its way stays)
    async #invite(userIds: string[]): Promise<boolean> {
        try {
            const sent = await this.client.inviteUsers(this.collection.id, userIds);
            if (sent) this.#dropPicked(userIds);
            return sent;
        } catch {
            return false;
        }
    }

    #inviteFailed(): ResourceKey {
        return i18nKey("group.inviteUsersFailed", undefined, this.collection.level, true);
    }

    /**
     * Sends the people picked here (`usersToAddOrInvite`), as the native Invite people screen sends
     * them in one go, each as `wayOf` says they'd join now (`inviteWay`): a private community's
     * members are added to the channel, the others invited. Anyone picked who can't be any more
     * (they've joined or been invited since, or the viewer may no longer invite them) isn't sent,
     * since the backend would refuse the whole batch for them, and leaves the picks. The adds and
     * the invites go separately: those sent leave the picks, the others stay picked, and the
     * outcome says who went and why the rest didn't. With no one left to send, nothing goes
     * (`none_left`).
     */
    async sendPicked(wayOf: (userId: string) => InviteWay): Promise<SendPicksOutcome> {
        const picks = [...this.#usersToAddOrInvite];
        const ways = new Map(picks.map((u) => [u.userId, wayOf(u.userId)]));
        const adding = picks.filter((u) => ways.get(u.userId) === "add");
        const inviting = picks.filter((u) => ways.get(u.userId) === "invite");
        this.#dropPicked(picks.filter((u) => !pickable(ways.get(u.userId) ?? "none")).map(ids));
        if (adding.length + inviting.length === 0) return { kind: "none_left" };

        this.#inviting = true;
        try {
            const toAdd = adding.map(ids);
            const add: AddedToChannel =
                toAdd.length === 0
                    ? { added: [], failure: undefined }
                    : await this.#addToChannel(toAdd);
            const addedIds = new Set(add.added);
            const added = adding.filter((u) => addedIds.has(u.userId));
            this.#dropPicked(added.map(ids));

            const invitedOk = inviting.length === 0 || (await this.#invite(inviting.map(ids)));
            const invited = invitedOk ? inviting : [];

            const failure = invitedOk ? add.failure : this.#inviteFailed();
            if (failure === undefined) return { kind: "sent", added, invited };
            return added.length + invited.length === 0
                ? { kind: "failed", message: failure }
                : { kind: "partly_sent", added, invited, message: failure };
        } finally {
            this.#inviting = false;
        }
    }

    #dropPicked(userIds: string[]): void {
        this.#usersToAddOrInvite = this.#usersToAddOrInvite.filter(
            (u) => !userIds.includes(u.userId),
        );
    }

    canUninvite() {
        return this.client.canInviteUsers(this.collection.id);
    }

    canInvite() {
        return this.client.canInviteUsers(this.collection.id);
    }

    canAdd() {
        const community = selectedCommunitySummaryStore.value;
        return (
            community !== undefined &&
            !community.public &&
            this.collection.kind === "channel" &&
            this.client.canAddMembers(this.collection.id)
        );
    }

    canBlockUsers() {
        return this.client.canBlockUsers(this.collection.id);
    }

    canUnblockUsers() {
        return this.client.canUnblockUsers(this.collection.id);
    }

    canRemoveMembers() {
        return this.client.canRemoveMembers(this.collection.id);
    }

    canPromote(from: MemberRole, to: MemberRole) {
        return this.client.canPromote(this.collection.id, from, to);
    }

    canDemote(from: MemberRole, to: MemberRole) {
        return this.client.canDemote(this.collection.id, from, to);
    }

    /** The role changes, removal and blocking offered for a member with `role` (`memberActions`). */
    actionsFor(role: MemberRole, isMe: boolean): MemberActions {
        return memberActions(role, isMe, {
            promote: (from, to) => this.canPromote(from, to),
            demote: (from, to) => this.canDemote(from, to),
            remove: this.canRemoveMembers(),
            block: this.canBlockUsers(),
        });
    }

    /** Loads the link; one that failed can be asked for again. */
    async initialiseSharing(): Promise<MemberActionOutcome> {
        if (this.#inviteLinkLoad.kind !== "loaded") this.#inviteLinkLoad = { kind: "loading" };
        const outcome = this.#applyInviteLink(await this.client.getInviteLink(this.collection));
        if (outcome.kind === "failed" && this.#inviteLinkLoad.kind === "loading") {
            this.#inviteLinkLoad = { kind: "failed" };
        }
        return outcome;
    }

    /** Switches the link on or off: to `enabled` when given, else the other way. */
    async toggleInviteLink(enabled?: boolean): Promise<MemberActionOutcome> {
        const link = this.inviteLink;
        if (this.#togglingSharingLink || (link?.kind !== "enabled" && link?.kind !== "disabled")) {
            return succeeded;
        }
        const on = enabled ?? link.kind === "disabled";
        if (on === (link.kind === "enabled")) return succeeded;
        this.#togglingSharingLink = true;
        try {
            return this.#applyInviteLink(
                await this.client.setInviteLinkEnabled(this.collection, on),
            );
        } finally {
            this.#togglingSharingLink = false;
        }
    }

    #applyInviteLink(outcome: InviteLinkOutcome): MemberActionOutcome {
        if (outcome.kind === "failed") return outcome;
        this.#inviteLinkLoad = { kind: "loaded", link: outcome };
        return succeeded;
    }

    async shareLink(url: string): Promise<MemberActionOutcome> {
        try {
            await navigator.share({ url, files: [] });
        } catch (e) {
            if (!(e instanceof DOMException && e.name === "AbortError")) {
                console.log(`Failed to share link ${url}: ${e}`);
                return { kind: "failed", message: i18nKey("failedToShareLink") };
            }
        }
        return succeeded;
    }

    /** The URL to share, once the link has loaded and if it is public or enabled */
    get sharingLink(): string | undefined {
        return inviteLinkUrl(
            this.client.canonicalOrigin(),
            this.collection.id,
            currentUserIdStore.value,
            this.inviteLink,
        );
    }

    canManageBots() {
        return this.client.canManageBots(this.collection.id);
    }

    canRegisterWebhook() {
        if (this.collection.kind === "community") return false;
        return this.client.canRegisterWebhook(this.collection.id);
    }
}
