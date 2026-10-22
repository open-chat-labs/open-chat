import type { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
import { type ReadonlyMap } from "../../utils";
import type { ResourceKey } from "../../utils/i18n";
import type { AuthProvider } from "../auth";
import type { MultiUserChat, PinNumberFailures } from "../chat";
import type { CommunitySummary } from "../community";
import type { DataContent } from "../data/data";
import type { OCError } from "../error";
import type {
    Failure,
    InternalError,
    Invalid,
    Offline,
    Retrying,
    Success,
    TransferFailed,
    UserSuspended,
} from "../response";

export type UserOrUserGroup = UserSummary | UserGroupSummary | MentionEveryone;

export type UserSummary = DataContent & {
    kind: "user" | "bot";
    userId: string;
    username: string;
    displayName: string | undefined;
    updated: bigint;
    suspended: boolean;
    diamondStatus: DiamondMembershipStatus["kind"];
    chitBalance: number;
    totalChitEarned: number;
    streak: number;
    maxStreak: number;
    isUniquePerson: boolean;
    hideOnlineStatus: boolean;
};

export type PartitionedUserIds = {
    userIds: Set<string>;
    webhooks: Set<string>;
};

// A deleted user is held as a placeholder which is never updated, so we never request updates for them
const DELETED_USER_UPDATED = BigInt(Number.MAX_VALUE);

export function deletedUser(userId: string): UserSummary {
    return {
        kind: "user",
        userId,
        blobUrl: "/assets/deletedUser.svg",
        username: "Deleted User",
        displayName: undefined,
        updated: DELETED_USER_UPDATED,
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        totalChitEarned: 0,
        hideOnlineStatus: false,
    };
}

export function isDeletedUser(user: UserSummary | undefined): boolean {
    return user?.updated === DELETED_USER_UPDATED;
}

// Note this *has* to return UserSummary | undefined because of the types, but we would not expect it to ever do so in practice
export function mergeUserSummaryWithUpdates(
    cached: UserSummary | undefined,
    updates: UserSummaryUpdate,
    timestamp: bigint,
): UserSummary | undefined {
    if (cached === undefined) {
        if (updates.stable === undefined || updates.volatile === undefined) {
            // in this case we cannot construct a valid UserSummary - this should not happen
            return undefined;
        }
        return {
            kind: updates.stable.isBot ? "bot" : "user",
            userId: updates.userId,
            ...updates.stable,
            ...updates.volatile,
            updated: timestamp,
        };
    }
    if (cached.userId !== updates.userId) {
        return undefined;
    }
    return {
        ...cached,
        ...updates.stable,
        ...updates.volatile,
    };
}

// problem - we can no longer create a UserSummary from a CurrentUserSummary
export function userSummaryFromCurrentUserSummary(currentSummary: CurrentUserSummary): UserSummary {
    return {
        kind: currentSummary.isBot ? "bot" : "user",
        userId: currentSummary.userId,
        username: currentSummary.username,
        displayName: currentSummary.displayName,
        updated: currentSummary.updated,
        suspended: currentSummary.suspensionDetails !== undefined,
        diamondStatus: currentSummary.diamondStatus.kind,
        chitBalance: currentSummary.chitBalance,
        totalChitEarned: currentSummary.totalChitEarned,
        streak: currentSummary.streak,
        maxStreak: currentSummary.maxStreak,
        blobReference: currentSummary.blobReference,
        blobData: currentSummary.blobData,
        blobUrl: currentSummary.blobUrl,
        isUniquePerson: currentSummary.isUniquePerson,
        hideOnlineStatus: currentSummary.hideOnlineStatus,
    };
}

export function updateCreatedUser(created: CreatedUser, summary: CurrentUserSummary): CreatedUser {
    return {
        ...created,
        ...summary,
        kind: "created_user",
    };
}

export type UserGroupSummary = {
    kind: "user_group";
    memberCount: number;
    name: string;
    id: number;
};

export type MentionEveryone = {
    kind: "everyone";
};

export type UserGroupDetails = {
    kind: "user_group";
    members: Set<string>;
    id: number;
    name: string;
};

export type PostLoginOperation =
    | CreateCommunity
    | RegisterBot
    | CreateGroup
    | JoinCommunity
    | JoinGroup;

export type CreateCommunity = {
    kind: "create_community";
};

export type RegisterBot = {
    kind: "register_bot";
};

export type CreateGroup = {
    kind: "create_group";
};

export type JoinCommunity = {
    kind: "join_community";
    community: CommunitySummary;
};

export type JoinGroup = {
    kind: "join_group";
    group: MultiUserChat;
};

export type IdentityState =
    | { kind: "anon"; postLogin?: PostLoginOperation }
    | { kind: "loading_user"; postLogin?: PostLoginOperation; registering: boolean }
    | { kind: "logged_in"; postLogin?: PostLoginOperation }
    | { kind: "registering"; postLogin?: PostLoginOperation }
    | { kind: "logging_in"; postLogin?: PostLoginOperation };

/** How the user is signing in: the client picks the browser's or the native app's passkeys. */
export type SignInMethod =
    | { kind: "passkey" }
    // Internet Identity or NFID, in the auth client's window
    | { kind: "auth_client"; provider: "ii" | "nfid" }
    // once the wallet has signed the message the backend prepared (siwePrepareLogin / siwsPrepareLogin)
    | { kind: "wallet"; token: "eth" | "sol"; address: string; signature: string };

/**
 * How a sign-in went, once the identity has loaded. `needs_account`: signed in with an identity
 * that has no OpenChat account yet, so sign-up comes next. `cancelled`: the passkey prompt or the
 * window was dismissed (or the passkey isn't one OpenChat knows), or the caller gave it up.
 */
export type SignInOutcome =
    | { kind: "logged_in" }
    | { kind: "needs_account" }
    | { kind: "cancelled" }
    | { kind: "failed"; reason: ResourceKey };

/**
 * How a sign-up went. `referral_refused`: the referral code was turned down, so no account was
 * made; the code won't be sent again, so signing up again goes ahead without it. `cancelled`: the
 * passkey prompt was dismissed, or the caller gave the sign-up up before the account was asked
 * for.
 */
export type SignUpOutcome =
    | { kind: "success" }
    | { kind: "referral_refused"; reason: ResourceKey }
    | { kind: "cancelled" }
    | { kind: "failed"; reason: ResourceKey };

/**
 * Asking for an emailed sign-in link. Sent: the code the email shows (so the person can tell it's
 * this request's link), and `signedIn`, which settles once the link is followed and this browser
 * has the identity, or `cancelled` when the request is given up. Given up while it was being sent,
 * it's `cancelled` and no link is waited for.
 */
export type EmailSignInRequest =
    | { kind: "sent"; code: string; signedIn: Promise<SignInOutcome> }
    | { kind: "failed"; reason: ResourceKey }
    | { kind: "cancelled" };

/**
 * How the signed-in user signs in again to prove it's them (resetting a forgotten PIN, claiming a
 * prize, deleting the account): a way to sign in, or an identity signed in some other way (the
 * old UIs' wallet buttons sign with the wallet themselves).
 */
export type ReAuthMethod =
    | SignInMethod
    | {
          kind: "identity";
          provider: AuthProvider;
          key: ECDSAKeyIdentity;
          delegation: DelegationChain;
      };

/**
 * How signing in again went. `success`: the identity is one of the user's own (the one they're
 * signed in with, or one linked to it), with the backend's proof of the sign-in, if it gave one.
 * `failed`: another account (`identity.failure.principalMismatch`), or the sign-in failed.
 * `cancelled`: the passkey prompt was dismissed, or the caller gave it up.
 */
export type ReAuthOutcome =
    | {
          kind: "success";
          provider: AuthProvider;
          key: ECDSAKeyIdentity;
          delegation: DelegationChain;
          signInProofJwt: string | undefined;
      }
    | { kind: "failed"; reason: ResourceKey }
    | { kind: "cancelled" };

/** Asking for an emailed link to sign in again with: as EmailSignInRequest, for ReAuthOutcome. */
export type EmailReAuthRequest =
    | { kind: "sent"; code: string; reAuthenticated: Promise<ReAuthOutcome> }
    | { kind: "failed"; reason: ResourceKey }
    | { kind: "cancelled" };

export type UserLookup = ReadonlyMap<string, UserSummary>;

export type User = {
    userId: string;
    username: string;
    displayName: string | undefined;
};

export type PublicProfile = {
    username: string;
    displayName: string | undefined;
    avatarId?: bigint;
    bio: string;
    isPremium: boolean;
    phoneIsVerified: boolean;
    created: bigint;
    backgroundId?: bigint;
};

export type ReducedPublicProfile = {
    username: string;
    displayName: string | undefined;
    isCurentUser: boolean;
    blobData?: Uint8Array<ArrayBufferLike>;
    blobUrl?: string;
};

export type UsersArgs = {
    userGroups: {
        users: string[];
        updatedSince: bigint;
    }[];
};

export type UsersResponse = {
    serverTimestamp?: bigint;
    users: UserSummary[];
    deletedUserIds: Set<string>;
    currentUser?: CurrentUserSummary;
    // Each requested id which belongs to a user who has since been migrated to a MultiUser
    // canister, mapped to that user's latest id, which is the id they're returned under
    migratedUserIds?: Map<string, string>;
};

export type UserSummaryStable = DataContent & {
    username: string;
    diamondStatus: DiamondMembershipStatus["kind"];
    isBot: boolean;
    displayName: string | undefined;
    suspended: boolean;
    isUniquePerson: boolean;
    hideOnlineStatus: boolean;
};

export type UserSummaryVolatile = {
    streak: number;
    maxStreak: number;
    chitBalance: number;
    totalChitEarned: number;
};

export type UserSummaryUpdate = {
    stable?: UserSummaryStable;
    userId: string;
    volatile?: UserSummaryVolatile;
    // The ids the user was requested by from before they were migrated to a MultiUser canister.
    // `userId` is their latest id.
    previousUserIds?: string[];
};

export type UsersApiResponse = {
    serverTimestamp: bigint;
    deletedUserIds: Set<string>;
    users: UserSummaryUpdate[];
    currentUser?: CurrentUserSummary;
};

export enum UserStatus {
    Offline,
    Online,
    None,
}

export enum AvatarSize {
    Tiny,
    Small,
    Default,
    Large,
}

export type CurrentUserResponse = CreatedUser | UserNotFound;

export type CurrentUser = CreatedUser | UserNotFound;

export type UpgradeInProgress = {
    kind: "upgrade_in_progress";
};

export const ANON_USER_ID = "does_this_need_to_be_a_principal";
export const ANON_USERNAME = "guest_user";
export const ANON_DISPLAY_NAME = "Guest user";
export const ANON_AVATAR_URL = "/assets/anon.svg";

type CurrentUserCommon = DataContent & {
    // The ids the user had before being migrated to a MultiUser canister, whose wallets may still
    // hold funds, and are in their transaction history
    previousUserIds?: string[];
    username: string;
    isPlatformOperator: boolean;
    diamondStatus: DiamondMembershipStatus;
    userId: string;
    isBot: boolean;
    displayName: string | undefined;
    moderationFlagsEnabled: number;
    isSuspectedBot: boolean;
    suspensionDetails: SuspensionDetails | undefined;
    isPlatformModerator: boolean;
    diamondDetails?: DiamondMembershipDetails;
    updated: bigint;
    isUniquePerson: boolean;
    totalChitEarned: number;
    chitBalance: number;
    streak: number;
    maxStreak: number;
    backgroundId?: bigint;
    hideOnlineStatus: boolean;
    // Absent on summaries from the user canister (only the user_index holds it), so updates
    // spread over a CreatedUser without clobbering the known value
    acceptedTermsVersion?: number;
    currentTermsVersion?: number;
};

export type CurrentUserSummary = CurrentUserCommon & {
    kind: "current_user_summary";
};

export type CreatedUser = CurrentUserCommon & {
    kind: "created_user";
    dateCreated: bigint;
    cryptoAccount: string;
};

export function anonymousUser(): CreatedUser {
    return {
        kind: "created_user",
        username: ANON_USERNAME,
        dateCreated: BigInt(0),
        displayName: ANON_DISPLAY_NAME, // TODO probably need to translate this
        cryptoAccount: "", // TODO - will this be a problem?
        userId: ANON_USER_ID,
        isPlatformModerator: false,
        isPlatformOperator: false,
        suspensionDetails: undefined,
        isSuspectedBot: false,
        diamondStatus: { kind: "inactive" },
        moderationFlagsEnabled: 0,
        isBot: false,
        updated: 0n,
        isUniquePerson: false,
        totalChitEarned: 0,
        chitBalance: 0,
        streak: 0,
        maxStreak: 0,
        hideOnlineStatus: false,
        // The anonymous user never sees the terms-updated notice; acceptance is captured when
        // an account is registered or next used
        acceptedTermsVersion: Number.MAX_SAFE_INTEGER,
    };
}

export type DiamondMembershipStatus =
    | { kind: "inactive" }
    | { kind: "lifetime" }
    | ({ kind: "active" } & DiamondMembershipDetails);

export type DiamondMembershipDetails = {
    payInChat: boolean;
    subscription: DiamondMembershipSubscription;
    expiresAt: bigint;
};

export type DiamondMembershipDuration = "one_month" | "three_months" | "one_year" | "lifetime";

export type DiamondMembershipSubscription = "one_month" | "three_months" | "one_year" | "disabled";

export type SuspensionDetails = {
    reason: string;
    action: SuspensionAction;
    suspendedBy: string;
};

export type SuspensionAction = UnsuspendAction | DeleteAction;

export type UnsuspendAction = {
    kind: "unsuspend_action";
    timestamp: bigint;
};

export type DeleteAction = {
    kind: "delete_action";
    timestamp: bigint;
};

export type UserNotFound = {
    kind: "unknown_user";
};

export type CheckUsernameResponse =
    | "success"
    | "username_taken"
    | "username_too_short"
    | "username_too_long"
    | "username_invalid"
    | "offline"
    | OCError;

export type SetUsernameResponse =
    | "success"
    | "username_taken"
    | "user_not_found"
    | "username_too_short"
    | "username_too_long"
    | "username_invalid"
    | "offline"
    | OCError;

export type SetDisplayNameResponse =
    | "success"
    | "user_not_found"
    | "display_name_too_short"
    | "display_name_too_long"
    | "display_name_invalid"
    | "offline"
    | OCError;

export type InvalidCurrency = { kind: "invalid_currency" };

export type SetBioResponse = Success | OCError | Offline;

/** i18n keys of the reasons the backend rejected profile fields, shown under each field */
export type ProfileFieldErrors = { username?: string; displayName?: string; bio?: string };

export type SaveProfileOutcome = {
    // the original profile with every field the backend accepted applied
    profile: PublicProfile;
    errors: ProfileFieldErrors;
    // set when a change could not be saved for a reason the user can't fix in the form
    failure?: ResourceKey;
};

export type RegisterUserResponse =
    | {
          kind: "success";
          userId: string;
          icpAccount: string;
      }
    | { kind: "user_limit_reached" }
    | { kind: "not_supported" }
    | { kind: "already_registered" }
    | { kind: "username_taken" }
    | { kind: "internal_error" }
    | { kind: "cycles_balance_too_low" }
    | { kind: "username_too_short" }
    | { kind: "username_too_long" }
    | { kind: "username_invalid" }
    | { kind: "email_invalid" }
    | { kind: "public_key_invalid" }
    | { kind: "referral_code_invalid" }
    | { kind: "referral_code_already_claimed" }
    | { kind: "referral_code_expired" }
    | { kind: "registration_in_progress" }
    | OCError
    | Offline;

export type PinChatResponse = Success | OCError | Offline;
export type UnpinChatResponse = Success | OCError | Offline;
export type ArchiveChatResponse = Success | OCError | Offline | Failure;
export type ManageFavouritesResponse = Success | OCError | Offline;

export type SuspendUserResponse =
    | "success"
    | "user_not_found"
    | "user_already_suspended"
    | "internal_error"
    | "offline";

export type UnsuspendUserResponse =
    | "success"
    | "user_not_found"
    | "user_not_suspended"
    | "internal_error"
    | "offline";

export type PayForDiamondMembershipResponse =
    | { kind: "payment_already_in_progress" }
    | { kind: "currency_not_supported" }
    | { kind: "success"; status: DiamondMembershipStatus; proof: string }
    | { kind: "price_mismatch" }
    | { kind: "transfer_failed" }
    | { kind: "internal_error" }
    | { kind: "cannot_extend" }
    | { kind: "user_not_found" }
    | { kind: "insufficient_funds" }
    | { kind: "already_lifetime_diamond_member" }
    | OCError
    | Offline;

export type CreateMultiUserCanisterResponse =
    | { kind: "success"; canisterId: string }
    | { kind: "local_user_index_not_found" }
    | InternalError;

// A balance left behind in the wallet of a canister the user had before being migrated to a
// MultiUser canister. Only that canister can move it, so it isn't in the user's wallet until the
// LocalUserIndex which controls the canister moves it there.
export type FundsInPreviousWallet = {
    previousUserId: string;
    ledger: string;
    balance: bigint;
};

export type MoveFundsResult =
    // `amount` arrived in the user's wallet, the ledger having charged `fee` on top
    | { kind: "moved"; amount: bigint; fee: bigint; blockIndex: bigint }
    // The balance, less the fee and any fee the ledger burns, didn't exceed the fee, so there was
    // nothing to move
    | { kind: "nothing_to_move" }
    // A transfer which timed out may still have been made, in which case the balance is gone from
    // the previous wallet
    | { kind: "failed"; error: OCError };

export type MoveFundsFromOldCanisterResponse =
    | { kind: "success"; outcomes: { ledger: string; result: MoveFundsResult }[] }
    | OCError;

export type MoveFundsOutcome = {
    previousUserId: string;
    ledger: string;
    result: MoveFundsResult;
};

export type SetMessageReminderResponse = Success | OCError | Offline;

export type ModerationFlag = 1 | 2 | 4;

export const ModerationFlags = {
    Offensive: 1 as ModerationFlag,
    Adult: 2 as ModerationFlag,
    UnderReview: 4 as ModerationFlag,
};

export type NamedAccount = {
    name: string;
    account: string;
};

export type SaveCryptoAccountResponse = Success | OCError | Failure;

export type DeleteCryptoAccountResponse = Success | OCError | Failure;

export type SubmitProposalResponse =
    | Success
    | Retrying
    | UserSuspended
    | GovernanceCanisterNotSupported
    | InsufficientPayment
    | TransferFailed
    | InternalError
    | Offline;

export type GovernanceCanisterNotSupported = {
    kind: "governance_canister_not_supported";
};

export type InsufficientPayment = {
    kind: "insufficient_payment";
};

// A step of a swap the user makes straight from their wallet, reported as the step starts, ahead of
// how the swap ended. The withdrawal is the DEX paying the output, `amountOut`, to the wallet.
export type SwapFromWalletStep =
    | { step: "approve" }
    | { step: "swap" }
    | { step: "withdraw"; amountOut: bigint };

export type SwapTokensStep = { kind: "swap_step" } & SwapFromWalletStep;

export type SwapTokensResponse =
    | {
          kind: "success";
          amountOut: bigint;
      }
    | {
          kind: "swap_failed";
      }
    | PinNumberFailures
    | InternalError
    | OCError;

export type ApproveTransferResponse = Success | OCError | InternalError;

export type DiamondMembershipFees = {
    token: "CHAT" | "ICP";
    oneMonth: bigint;
    threeMonths: bigint;
    oneYear: bigint;
    lifetime: bigint;
};

export type SubmitProofOfUniquePersonhoodResponse = Success | Invalid | UserNotFound | OCError;

export type ReferralStatus = "registered" | "diamond" | "unique_person" | "lifetime_diamond";

export type Referral = {
    userId: string;
    status: ReferralStatus;
};

// The result of proposing a dual-authorized operator action: nothing has taken effect yet,
// and `alreadyPending` means an identical action was already queued so this changed nothing
export type ProposedProtectedAction = {
    actionId: bigint;
    alreadyPending: boolean;
};

export type ModerationConfig = {
    openaiApiKeySet: boolean;
    internalModerationChannel: { communityId: string; channelId: number } | undefined;
    referralConfig: { categories: { category: number; scoreThreshold: number }[] } | undefined;
    vaultReviewers: string[];
    mediaScanEnabled: boolean;
    mediaScanners: string[];
    // The registered principal of the off-chain NCA reporting service, if any
    authorityReporter: string | undefined;
};
