import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    CurrentUserResponse,
    CurrentUserArgs,
    SetUsernameArgs,
    CheckUsernameResponse,
    SetUsernameResponse,
    SetDisplayNameResponse,
    UserRegistrationCanisterResponse,
    UsersV2Args,
    UsersV2Response,
    UserSummary,
    SearchArgs,
    SearchResponse,
    RegisterUserResponse,
    SuspendUserResponse,
    UnsuspendUserResponse,
    SuspensionDetails,
    SuspensionAction,
    DiamondMembershipDetails,
    DiamondMembershipFeesResponse,
    DiamondMembershipPlanDuration,
    PayForDiamondMembershipResponse,
    ReferralLeaderboardResponse,
    ReferralStats,
    SetModerationFlagsResponse,
    DiamondMembershipStatus,
    DiamondMembershipStatusFull,
    DiamondMembershipSubscription,
    ClaimDailyChitResponse,
    ChitUserBalance
} from "./types";
export {
    _SERVICE as UserIndexService,
    CurrentUserResponse as ApiCurrentUserResponse,
    CurrentUserArgs as ApiCurrentUserArgs,
    SetUsernameArgs as ApiSetUsernameArgs,
    CheckUsernameResponse as ApiCheckUsernameResponse,
    SetUsernameResponse as ApiSetUsernameResponse,
    SetDisplayNameResponse as ApiSetDisplayNameResponse,
    UserRegistrationCanisterResponse as ApiUserRegistrationCanisterResponse,
    UsersV2Args as ApiUsersArgs,
    UsersV2Response as ApiUsersResponse,
    UserSummary as ApiUserSummary,
    SearchArgs as ApiSearchArgs,
    SearchResponse as ApiSearchResponse,
    RegisterUserResponse as ApiRegisterUserResponse,
    SuspendUserResponse as ApiSuspendUserResponse,
    UnsuspendUserResponse as ApiUnsuspendUserResponse,
    SuspensionDetails as ApiSuspensionDetails,
    SuspensionAction as ApiSuspensionAction,
    DiamondMembershipDetails as ApiDiamondMembershipDetails,
    DiamondMembershipFeesResponse as ApiDiamondMembershipFeesResponse,
    DiamondMembershipPlanDuration as ApiDiamondMembershipPlanDuration,
    PayForDiamondMembershipResponse as ApiPayForDiamondMembershipResponse,
    ReferralLeaderboardResponse as ApiReferralLeaderboardResponse,
    ReferralStats as ApiReferralStats,
    SetModerationFlagsResponse as ApiSetModerationFlagsResponse,
    DiamondMembershipStatus as ApiDiamondMembershipStatus,
    DiamondMembershipStatusFull as ApiDiamondMembershipStatusFull,
    DiamondMembershipSubscription as ApiDiamondMembershipSubscription,
    ClaimDailyChitResponse as ApiClaimDailyChitResponse,
    ChitUserBalance as ApiChitUserBalance,
};

export const idlFactory: IDL.InterfaceFactory;
