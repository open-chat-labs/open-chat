import {
    ErrorCode,
    i18nKey,
    isBalanceGate,
    isChitEarnedGate,
    isCompositeGate,
    isCredentialGate,
    isNeuronGate,
    isPaymentGate,
    type AccessGateConfig,
    type CandidateGroupChat,
    type CreateGroupResponse,
    defaultChatRules,
    type GroupChangeConfirmation,
    type GroupChanges,
    type Level,
    type MultiUserChat,
    type ResourceKey,
    type Rules,
    type UpdateGroupOutcome,
    type UpdateGroupResponse,
} from "@shared";
import { diffGroupPermissions } from "./chat";

export function hasAccessGateChanged(
    currentConfig: AccessGateConfig,
    originalConfig: AccessGateConfig,
): boolean {
    if (currentConfig === originalConfig) return false;
    const current = currentConfig.gate;
    const original = originalConfig.gate;
    if (current.kind !== original.kind) return true;
    if (currentConfig.expiry !== originalConfig.expiry) return true;
    if (isChitEarnedGate(current) && isChitEarnedGate(original)) {
        return current.minEarned !== original.minEarned;
    }
    if (isNeuronGate(current) && isNeuronGate(original)) {
        return (
            current.governanceCanister !== original.governanceCanister ||
            current.minDissolveDelay !== original.minDissolveDelay ||
            current.minStakeE8s !== original.minStakeE8s
        );
    }
    if (isPaymentGate(current) && isPaymentGate(original)) {
        return (
            current.ledgerCanister !== original.ledgerCanister || current.amount !== original.amount
        );
    }
    if (isBalanceGate(current) && isBalanceGate(original)) {
        return (
            current.ledgerCanister !== original.ledgerCanister ||
            current.minBalance !== original.minBalance
        );
    }
    if (isCredentialGate(current) && isCredentialGate(original)) {
        return JSON.stringify(current.credential) !== JSON.stringify(original.credential);
    }
    if (isCompositeGate(current) && isCompositeGate(original)) {
        return JSON.stringify(current) !== JSON.stringify(original);
    }
    return false;
}

// A group as it is now, for the user to edit, with its rules or the default ones. The chat can be
// reactive state, whose proxies structuredClone can't copy, so it is copied with a snapshot.
export function candidateGroupFromChat(
    chat: MultiUserChat,
    rules: Rules | undefined,
): CandidateGroupChat {
    return {
        id: chat.id,
        kind: "candidate_group_chat",
        name: chat.name,
        description: chat.description,
        historyVisible: chat.historyVisible,
        public: chat.public,
        frozen: chat.frozen,
        members: [],
        permissions: $state.snapshot(chat.permissions),
        rules: { ...(rules ?? defaultChatRules(chat.level)), newVersion: false },
        avatar: {
            blobReference: chat.blobReference,
            blobUrl: chat.blobUrl,
            blobData: chat.blobData,
        },
        gateConfig: $state.snapshot(chat.gateConfig),
        level: chat.level,
        membership: chat.membership,
        eventsTTL: chat.eventsTTL,
        messagesVisibleToNonMembers: chat.messagesVisibleToNonMembers,
        externalUrl: chat.kind === "channel" ? chat.externalUrl : undefined,
        verified: chat.kind === "group_chat" ? chat.verified : false,
    };
}

/**
 * What the user has changed about a group they are editing, holding only the fields that differ. A
 * group with no changes gives an empty object.
 */
export function groupChanges(
    original: CandidateGroupChat,
    candidate: CandidateGroupChat,
): GroupChanges {
    const changes: GroupChanges = {};
    if (candidate.name !== original.name) changes.name = candidate.name;
    if (candidate.description !== original.description) {
        changes.description = candidate.description;
    }
    if (
        candidate.rules.enabled !== original.rules.enabled ||
        candidate.rules.text !== original.rules.text
    ) {
        changes.rules = candidate.rules;
    }
    const permissions = diffGroupPermissions(original.permissions, candidate.permissions);
    if (permissions !== undefined) changes.permissions = permissions;
    if (candidate.avatar?.blobUrl !== original.avatar?.blobUrl) {
        changes.avatar = candidate.avatar?.blobData;
    }
    if (candidate.eventsTTL !== original.eventsTTL) {
        changes.eventsTimeToLive =
            candidate.eventsTTL === undefined ? "set_to_none" : { value: candidate.eventsTTL };
    }
    if (hasAccessGateChanged(candidate.gateConfig, original.gateConfig)) {
        changes.gateConfig = candidate.gateConfig;
    }
    if (candidate.public !== original.public) changes.isPublic = candidate.public;
    if (candidate.messagesVisibleToNonMembers !== original.messagesVisibleToNonMembers) {
        changes.messagesVisibleToNonMembers = candidate.messagesVisibleToNonMembers;
    }
    if (candidate.externalUrl !== original.externalUrl) {
        changes.externalUrl = candidate.externalUrl;
    }
    return changes;
}

// The first of the changes the user has yet to confirm, in the order they are asked
export function groupChangeConfirmationNeeded(
    original: CandidateGroupChat,
    changes: GroupChanges,
    confirmed: GroupChangeConfirmation[],
): GroupChangeConfirmation | undefined {
    if (changes.name !== undefined && original.verified && !confirmed.includes("verified_name")) {
        return "verified_name";
    }
    if (changes.isPublic !== undefined && !confirmed.includes("visibility")) {
        return "visibility";
    }
    return undefined;
}

function groupMessage(key: string, level: Level): ResourceKey {
    return i18nKey(key, undefined, level, true);
}

export function groupUpdateResult(resp: UpdateGroupResponse, level: Level): UpdateGroupOutcome {
    const failed = (key: string): UpdateGroupOutcome => ({
        kind: "failed",
        message: groupMessage(key, level),
    });
    switch (resp.kind) {
        case "success":
            return { kind: "success" };
        case "unchanged":
            return { kind: "unchanged" };
        case "name_too_short":
            return failed("groupNameTooShort");
        case "name_too_long":
            return failed("groupNameTooLong");
        case "name_reserved":
            return failed("groupNameReserved");
        case "desc_too_long":
            return failed("groupDescTooLong");
        case "name_taken":
            return failed(level === "group" ? "groupAlreadyExists" : "channelAlreadyExists");
        case "not_in_group":
            return failed("userNotInGroup");
        case "internal_error":
        case "not_authorized":
            return failed("groupUpdateFailed");
        case "avatar_too_big":
            return failed("avatarTooBig");
        case "rules_too_short":
            return failed("groupRulesTooShort");
        case "rules_too_long":
            return failed("groupRulesTooLong");
        case "user_suspended":
            return failed("userSuspended");
        case "user_lapsed":
            return failed("userLapsed");
        case "chat_frozen":
            return failed("chatFrozen");
        case "failure":
        case "error":
            return failed("failure");
        case "offline":
            return failed("offlineError");
        case "access_gate_invalid":
            return failed("access.gateInvalid");
        default:
            return resp satisfies never;
    }
}

export function groupCreationFailure(resp: CreateGroupResponse, level: Level): ResourceKey {
    if (resp.kind === "offline") return groupMessage("offlineError", level);
    if (resp.kind === "error") {
        switch (resp.code) {
            case ErrorCode.NameTooShort:
                return groupMessage("groupNameTooShort", level);
            case ErrorCode.NameTooLong:
                return groupMessage("groupNameTooLong", level);
            case ErrorCode.NameReserved:
                return groupMessage("groupNameReserved", level);
            case ErrorCode.DescriptionTooLong:
                return groupMessage("groupDescTooLong", level);
            case ErrorCode.NameTaken:
                return groupMessage(
                    level === "group" ? "groupAlreadyExists" : "channelAlreadyExists",
                    level,
                );
            case ErrorCode.AvatarTooBig:
                return groupMessage("groupAvatarTooBig", level);
            case ErrorCode.MaxGroupsCreated:
                return groupMessage("maxGroupsCreated", level);
            case ErrorCode.RulesTooShort:
                return groupMessage("groupRulesTooShort", level);
            case ErrorCode.RulesTooLong:
                return groupMessage("groupRulesTooLong", level);
            case ErrorCode.InitiatorSuspended:
                return groupMessage("userSuspended", level);
            case ErrorCode.NotDiamondMember:
                return groupMessage("unauthorizedToCreatePublicGroup", level);
            case ErrorCode.InvalidAccessGate:
                return groupMessage("access.gateInvalid", level);
        }
    }
    return groupMessage("groupCreationFailed", level);
}
