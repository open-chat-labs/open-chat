import { i18nKey } from "@src/i18n/i18n";
import { reactiveValue } from "@src/utils/reactiveValue";
import {
    currentUserIdStore,
    FIND_MEMBERS_DELAY_MS,
    inviteLinkUrl,
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
    type MemberRole,
    type MessageFormatter,
    type MultiUserChat,
    type OpenChat,
    type ReadonlyMap,
    type ReadonlySet,
    type ResourceKey,
    type UserOrUserGroup,
    type UserSummary,
    type WebhookDetails,
} from "@client";

// A community has no webhooks
const noWebhooks: ReadonlyMap<string, WebhookDetails> = new Map();

// irritatingly this is a nat8 in the candid
const MAX_SEARCH_RESULTS = 255;

/** What a member action did, for the view to show: a success may have something to say, a failure always does */
export type MemberActionOutcome =
    | { kind: "success"; message?: ResourceKey }
    | { kind: "failed"; message: ResourceKey };

const succeeded: MemberActionOutcome = { kind: "success" };

function outcome(success: boolean, succeededKey: string, failedKey: string): MemberActionOutcome {
    return success
        ? { kind: "success", message: i18nKey(succeededKey) }
        : { kind: "failed", message: i18nKey(failedKey) };
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
    // undefined until the link has loaded
    #inviteLink = $state<InviteLink>();
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

    get inviteLink() {
        return this.#inviteLink;
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

    async addUsers(): Promise<MemberActionOutcome> {
        const failed: MemberActionOutcome = {
            kind: "failed",
            message: i18nKey("group.addMembersFailed"),
        };
        if (this.collection.kind !== "channel") return failed;

        this.#inviting = true;
        const userIds = this.#usersToAddOrInvite.map((u) => u.userId);
        try {
            const resp = await this.client.addMembersToChannel(
                this.collection.id as ChannelIdentifier,
                userIds,
            );
            switch (resp.kind) {
                case "success":
                    return succeeded;
                case "add_to_channel_partial_success":
                    return { kind: "success", message: i18nKey("group.addMembersPartialSuccess") };
                default:
                    return failed;
            }
        } catch {
            return failed;
        } finally {
            this.#inviting = false;
        }
    }

    async inviteUsers(): Promise<MemberActionOutcome> {
        if (this.#usersToAddOrInvite.length === 0) return succeeded;

        const failed: MemberActionOutcome = {
            kind: "failed",
            message: i18nKey("group.inviteUsersFailed", undefined, this.collection.level, true),
        };
        this.#inviting = true;
        try {
            const resp = await this.client.inviteUsers(
                this.collection.id,
                this.#usersToAddOrInvite.map((u) => u.userId),
            );
            if (!resp) return failed;
            this.#usersToAddOrInvite = [];
            return this.collection.public
                ? { kind: "success", message: i18nKey("group.usersInvited") }
                : succeeded;
        } catch {
            return failed;
        } finally {
            this.#inviting = false;
        }
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

    async initialiseSharing(): Promise<MemberActionOutcome> {
        return this.#applyInviteLink(await this.client.getInviteLink(this.collection));
    }

    async toggleInviteLink(): Promise<MemberActionOutcome> {
        const link = this.#inviteLink;
        if (this.#togglingSharingLink || (link?.kind !== "enabled" && link?.kind !== "disabled")) {
            return succeeded;
        }
        this.#togglingSharingLink = true;
        try {
            return this.#applyInviteLink(
                await this.client.setInviteLinkEnabled(this.collection, link.kind === "disabled"),
            );
        } finally {
            this.#togglingSharingLink = false;
        }
    }

    #applyInviteLink(outcome: InviteLinkOutcome): MemberActionOutcome {
        if (outcome.kind === "failed") return outcome;
        this.#inviteLink = outcome;
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
            this.#inviteLink,
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
