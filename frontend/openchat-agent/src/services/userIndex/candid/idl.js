export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const AddPlatformModeratorArgs = IDL.Record({ 'user_id' : UserId });
  const AddPlatformModeratorResponse = IDL.Variant({
    'AlreadyPlatformModerator' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const AddPlatformOperatorArgs = IDL.Record({ 'user_id' : UserId });
  const AddPlatformOperatorResponse = IDL.Variant({ 'Success' : IDL.Null });
  const ReferralType = IDL.Variant({
    'User' : IDL.Null,
    'BtcMiami' : IDL.Null,
  });
  const TimestampMillis = IDL.Nat64;
  const AddReferralCodesArgs = IDL.Record({
    'codes' : IDL.Vec(IDL.Text),
    'referral_type' : ReferralType,
    'expiry' : IDL.Opt(TimestampMillis),
  });
  const AddReferralCodesResponse = IDL.Variant({ 'Success' : IDL.Null });
  const ChatId = CanisterId;
  const AssignPlatformModeratorsGroupArgs = IDL.Record({ 'group_id' : ChatId });
  const AssignPlatformModeratorsGroupResponse = IDL.Variant({
    'AlreadySet' : ChatId,
    'Success' : IDL.Null,
  });
  const CheckUsernameArgs = IDL.Record({ 'username' : IDL.Text });
  const CheckUsernameResponse = IDL.Variant({
    'UsernameTaken' : IDL.Null,
    'UsernameTooShort' : IDL.Nat16,
    'UsernameInvalid' : IDL.Null,
    'UsernameTooLong' : IDL.Nat16,
    'Success' : IDL.Null,
  });
  const EmptyArgs = IDL.Record({});
  const ChitUserBalance = IDL.Record({
    'username' : IDL.Text,
    'balance' : IDL.Nat32,
    'user_id' : UserId,
  });
  const ChitLeaderboardResponse = IDL.Variant({
    'Success' : IDL.Vec(ChitUserBalance),
  });
  const DiamondMembershipSubscription = IDL.Variant({
    'OneYear' : IDL.Null,
    'ThreeMonths' : IDL.Null,
    'Disabled' : IDL.Null,
    'OneMonth' : IDL.Null,
  });
  const DiamondMembershipDetails = IDL.Record({
    'pay_in_chat' : IDL.Bool,
    'subscription' : DiamondMembershipSubscription,
    'expires_at' : TimestampMillis,
  });
  const DiamondMembershipStatusFull = IDL.Variant({
    'Inactive' : IDL.Null,
    'Lifetime' : IDL.Null,
    'Active' : DiamondMembershipDetails,
  });
  const BuildVersion = IDL.Record({
    'major' : IDL.Nat32,
    'minor' : IDL.Nat32,
    'patch' : IDL.Nat32,
  });
  const AccountIdentifier = IDL.Vec(IDL.Nat8);
  const CanisterUpgradeStatus = IDL.Variant({
    'NotRequired' : IDL.Null,
    'InProgress' : IDL.Null,
  });
  const SuspensionAction = IDL.Variant({
    'Unsuspend' : TimestampMillis,
    'Delete' : TimestampMillis,
  });
  const SuspensionDetails = IDL.Record({
    'action' : SuspensionAction,
    'suspended_by' : UserId,
    'reason' : IDL.Text,
  });
  const CurrentUserResponse = IDL.Variant({
    'Success' : IDL.Record({
      'username' : IDL.Text,
      'date_created' : TimestampMillis,
      'is_platform_operator' : IDL.Bool,
      'diamond_membership_status' : DiamondMembershipStatusFull,
      'wasm_version' : BuildVersion,
      'icp_account' : AccountIdentifier,
      'is_unique_person' : IDL.Bool,
      'referrals' : IDL.Vec(UserId),
      'user_id' : UserId,
      'display_name' : IDL.Opt(IDL.Text),
      'avatar_id' : IDL.Opt(IDL.Nat),
      'moderation_flags_enabled' : IDL.Nat32,
      'is_suspected_bot' : IDL.Bool,
      'canister_upgrade_status' : CanisterUpgradeStatus,
      'suspension_details' : IDL.Opt(SuspensionDetails),
      'is_platform_moderator' : IDL.Bool,
      'diamond_membership_details' : IDL.Opt(DiamondMembershipDetails),
    }),
    'UserNotFound' : IDL.Null,
  });
  const Cryptocurrency = IDL.Variant({
    'InternetComputer' : IDL.Null,
    'CHAT' : IDL.Null,
    'SNS1' : IDL.Null,
    'KINIC' : IDL.Null,
    'CKBTC' : IDL.Null,
    'Other' : IDL.Text,
  });
  const DiamondMembershipFeesResponse = IDL.Variant({
    'Success' : IDL.Vec(
      IDL.Record({
        'one_year' : IDL.Nat64,
        'token' : Cryptocurrency,
        'lifetime' : IDL.Nat64,
        'one_month' : IDL.Nat64,
        'three_months' : IDL.Nat64,
      })
    ),
  });
  const MarkSuspectedBotArgs = IDL.Record({});
  const MarkSuspectedBotResponse = IDL.Variant({ 'Success' : IDL.Null });
  const DiamondMembershipPlanDuration = IDL.Variant({
    'OneYear' : IDL.Null,
    'Lifetime' : IDL.Null,
    'ThreeMonths' : IDL.Null,
    'OneMonth' : IDL.Null,
  });
  const PayForDiamondMembershipArgs = IDL.Record({
    'token' : Cryptocurrency,
    'duration' : DiamondMembershipPlanDuration,
    'recurring' : IDL.Bool,
    'expected_price_e8s' : IDL.Nat64,
  });
  const PayForDiamondMembershipResponse = IDL.Variant({
    'PaymentAlreadyInProgress' : IDL.Null,
    'CurrencyNotSupported' : IDL.Null,
    'Success' : IDL.Record({
      'proof_jwt' : IDL.Text,
      'pay_in_chat' : IDL.Bool,
      'subscription' : DiamondMembershipSubscription,
      'expires_at' : TimestampMillis,
    }),
    'AlreadyLifetimeDiamondMember' : IDL.Null,
    'PriceMismatch' : IDL.Null,
    'TransferFailed' : IDL.Text,
    'InternalError' : IDL.Text,
    'UserNotFound' : IDL.Null,
    'InsufficientFunds' : IDL.Nat64,
  });
  const PlatformModeratorsResponse = IDL.Variant({
    'Success' : IDL.Record({ 'users' : IDL.Vec(UserId) }),
  });
  const PlatformModeratorsGroupResponse = IDL.Variant({ 'Success' : ChatId });
  const PlatformOperatorsArgs = IDL.Record({});
  const PlatformOperatorsResponse = IDL.Variant({
    'Success' : IDL.Record({ 'users' : IDL.Vec(UserId) }),
  });
  const PublicKeyResponse = IDL.Variant({
    'NotInitialised' : IDL.Null,
    'Success' : IDL.Text,
  });
  const ReferralMetricsResponse = IDL.Variant({
    'Success' : IDL.Record({
      'users_who_referred' : IDL.Nat32,
      'users_who_referred_unpaid_diamond' : IDL.Nat32,
      'referrals_of_unpaid_diamond' : IDL.Nat32,
      'icp_raised_by_referrals_to_paid_diamond' : IDL.Nat32,
      'referrals_of_paid_diamond' : IDL.Nat32,
      'users_who_referred_paid_diamond' : IDL.Nat32,
      'referrals_other' : IDL.Nat32,
      'users_who_referred_90_percent_unpaid_diamond' : IDL.Nat32,
    }),
  });
  const RemovePlatformModeratorArgs = IDL.Record({ 'user_id' : UserId });
  const RemovePlatformModeratorResponse = IDL.Variant({
    'Success' : IDL.Null,
    'NotPlatformModerator' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const RemovePlatformOperatorArgs = IDL.Record({ 'user_id' : UserId });
  const RemovePlatformOperatorResponse = IDL.Variant({ 'Success' : IDL.Null });
  const ReportedMessagesArgs = IDL.Record({ 'user_id' : IDL.Opt(UserId) });
  const ReportedMessagesResponse = IDL.Variant({
    'Success' : IDL.Record({ 'json' : IDL.Text }),
  });
  const SearchArgs = IDL.Record({
    'max_results' : IDL.Nat8,
    'search_term' : IDL.Text,
  });
  const DiamondMembershipStatus = IDL.Variant({
    'Inactive' : IDL.Null,
    'Lifetime' : IDL.Null,
    'Active' : IDL.Null,
  });
  const UserSummary = IDL.Record({
    'streak' : IDL.Nat16,
    'username' : IDL.Text,
    'total_chit_earned' : IDL.Int32,
    'diamond_member' : IDL.Bool,
    'diamond_membership_status' : DiamondMembershipStatus,
    'is_unique_person' : IDL.Bool,
    'user_id' : UserId,
    'is_bot' : IDL.Bool,
    'display_name' : IDL.Opt(IDL.Text),
    'avatar_id' : IDL.Opt(IDL.Nat),
    'chit_balance' : IDL.Int32,
    'suspended' : IDL.Bool,
  });
  const SearchResponse = IDL.Variant({
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'users' : IDL.Vec(UserSummary),
    }),
  });
  const DiamondMembershipFeesByDuration = IDL.Record({
    'one_year' : IDL.Nat64,
    'lifetime' : IDL.Nat64,
    'one_month' : IDL.Nat64,
    'three_months' : IDL.Nat64,
  });
  const SetDiamondMembershipFeesArgs = IDL.Record({
    'fees' : IDL.Record({
      'icp_fees' : DiamondMembershipFeesByDuration,
      'chat_fees' : DiamondMembershipFeesByDuration,
    }),
  });
  const SetDiamondMembershipFeesResponse = IDL.Variant({
    'Invalid' : IDL.Null,
    'Success' : IDL.Null,
  });
  const SetDisplayNameArgs = IDL.Record({ 'display_name' : IDL.Opt(IDL.Text) });
  const SetDisplayNameResponse = IDL.Variant({
    'DisplayNameInvalid' : IDL.Null,
    'Success' : IDL.Null,
    'DisplayNameTooLong' : IDL.Nat16,
    'Unauthorized' : IDL.Null,
    'DisplayNameTooShort' : IDL.Nat16,
    'UserNotFound' : IDL.Null,
  });
  const SetModerationFlagsArgs = IDL.Record({
    'moderation_flags_enabled' : IDL.Nat32,
  });
  const SetModerationFlagsResponse = IDL.Variant({ 'Success' : IDL.Null });
  const SetUserUpgradeConcurrencyArgs = IDL.Record({ 'value' : IDL.Nat32 });
  const SetUserUpgradeConcurrencyResponse = IDL.Variant({
    'Success' : IDL.Null,
  });
  const SetUsernameArgs = IDL.Record({ 'username' : IDL.Text });
  const SetUsernameResponse = IDL.Variant({
    'UsernameTaken' : IDL.Null,
    'UsernameTooShort' : IDL.Nat16,
    'UsernameInvalid' : IDL.Null,
    'UsernameTooLong' : IDL.Nat16,
    'Success' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  const SubmitProofOfUniquePersonhoodArgs = IDL.Record({
    'credential_jwt' : IDL.Text,
    'user_ii_principal' : IDL.Principal,
  });
  const SubmitProofOfUniquePersonhoodResponse = IDL.Variant({
    'Invalid' : IDL.Text,
    'Success' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  const SuspectedBotsArgs = IDL.Record({
    'after' : IDL.Opt(UserId),
    'count' : IDL.Nat32,
  });
  const SuspectedBotsResponse = IDL.Variant({
    'Success' : IDL.Record({ 'users' : IDL.Vec(UserId) }),
  });
  const Milliseconds = IDL.Nat64;
  const SuspendUserArgs = IDL.Record({
    'duration' : IDL.Opt(Milliseconds),
    'user_id' : UserId,
    'reason' : IDL.Text,
  });
  const SuspendUserResponse = IDL.Variant({
    'UserAlreadySuspended' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
    'UserNotFound' : IDL.Null,
  });
  const UnsuspendUserArgs = IDL.Record({ 'user_id' : UserId });
  const UnsuspendUserResponse = IDL.Variant({
    'UserNotSuspended' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
    'UserNotFound' : IDL.Null,
  });
  const UpdateDiamondMembershipSubscriptionArgs = IDL.Record({
    'pay_in_chat' : IDL.Opt(IDL.Bool),
    'subscription' : IDL.Opt(DiamondMembershipSubscription),
  });
  const UpdateDiamondMembershipSubscriptionResponse = IDL.Variant({
    'NotDiamondMember' : IDL.Null,
    'Success' : IDL.Null,
    'AlreadyLifetimeDiamondMember' : IDL.Null,
  });
  const UserArgs = IDL.Record({
    'username' : IDL.Opt(IDL.Text),
    'user_id' : IDL.Opt(UserId),
  });
  const UserResponse = IDL.Variant({
    'Success' : UserSummary,
    'UserNotFound' : IDL.Null,
  });
  const UserRegistrationCanisterResponse = IDL.Variant({
    'Success' : CanisterId,
    'NewRegistrationsClosed' : IDL.Null,
  });
  const UsersArgs = IDL.Record({
    'user_groups' : IDL.Vec(
      IDL.Record({
        'users' : IDL.Vec(UserId),
        'updated_since' : TimestampMillis,
      })
    ),
    'users_suspended_since' : IDL.Opt(TimestampMillis),
  });
  const BotConfig = IDL.Record({
    'can_be_added_to_groups' : IDL.Bool,
    'is_oc_controlled' : IDL.Bool,
    'supports_direct_messages' : IDL.Bool,
  });
  const UserSummaryStable = IDL.Record({
    'username' : IDL.Text,
    'bot_config' : IDL.Opt(BotConfig),
    'diamond_membership_status' : DiamondMembershipStatus,
    'is_unique_person' : IDL.Bool,
    'is_bot' : IDL.Bool,
    'display_name' : IDL.Opt(IDL.Text),
    'avatar_id' : IDL.Opt(IDL.Nat),
    'suspended' : IDL.Bool,
  });
  const UserSummaryVolatile = IDL.Record({
    'streak' : IDL.Nat16,
    'total_chit_earned' : IDL.Int32,
    'chit_balance' : IDL.Int32,
  });
  const UserSummaryV2 = IDL.Record({
    'stable' : IDL.Opt(UserSummaryStable),
    'user_id' : UserId,
    'volatile' : IDL.Opt(UserSummaryVolatile),
  });
  const CurrentUserSummary = IDL.Record({
    'username' : IDL.Text,
    'is_platform_operator' : IDL.Bool,
    'diamond_membership_status' : DiamondMembershipStatusFull,
    'is_unique_person' : IDL.Bool,
    'user_id' : UserId,
    'is_bot' : IDL.Bool,
    'display_name' : IDL.Opt(IDL.Text),
    'avatar_id' : IDL.Opt(IDL.Nat),
    'moderation_flags_enabled' : IDL.Nat32,
    'is_suspected_bot' : IDL.Bool,
    'suspension_details' : IDL.Opt(SuspensionDetails),
    'is_platform_moderator' : IDL.Bool,
    'diamond_membership_details' : IDL.Opt(DiamondMembershipDetails),
  });
  const UsersResponse = IDL.Variant({
    'Success' : IDL.Record({
      'deleted' : IDL.Vec(UserId),
      'timestamp' : TimestampMillis,
      'users' : IDL.Vec(UserSummaryV2),
      'current_user' : IDL.Opt(CurrentUserSummary),
    }),
  });
  const UsersChitArgs = IDL.Record({
    'month' : IDL.Nat8,
    'year' : IDL.Nat16,
    'users' : IDL.Vec(UserId),
  });
  const Chit = IDL.Record({ 'streak' : IDL.Nat16, 'balance' : IDL.Int32 });
  const UsersChitResponse = IDL.Variant({
    'Success' : IDL.Record({ 'chit' : IDL.Vec(Chit) }),
  });
  return IDL.Service({
    'add_platform_moderator' : IDL.Func(
        [AddPlatformModeratorArgs],
        [AddPlatformModeratorResponse],
        [],
      ),
    'add_platform_operator' : IDL.Func(
        [AddPlatformOperatorArgs],
        [AddPlatformOperatorResponse],
        [],
      ),
    'add_referral_codes' : IDL.Func(
        [AddReferralCodesArgs],
        [AddReferralCodesResponse],
        [],
      ),
    'assign_platform_moderators_group' : IDL.Func(
        [AssignPlatformModeratorsGroupArgs],
        [AssignPlatformModeratorsGroupResponse],
        [],
      ),
    'check_username' : IDL.Func(
        [CheckUsernameArgs],
        [CheckUsernameResponse],
        ['query'],
      ),
    'chit_leaderboard' : IDL.Func(
        [EmptyArgs],
        [ChitLeaderboardResponse],
        ['query'],
      ),
    'current_user' : IDL.Func([EmptyArgs], [CurrentUserResponse], ['query']),
    'diamond_membership_fees' : IDL.Func(
        [EmptyArgs],
        [DiamondMembershipFeesResponse],
        ['query'],
      ),
    'mark_suspected_bot' : IDL.Func(
        [MarkSuspectedBotArgs],
        [MarkSuspectedBotResponse],
        [],
      ),
    'pay_for_diamond_membership' : IDL.Func(
        [PayForDiamondMembershipArgs],
        [PayForDiamondMembershipResponse],
        [],
      ),
    'platform_moderators' : IDL.Func(
        [EmptyArgs],
        [PlatformModeratorsResponse],
        ['query'],
      ),
    'platform_moderators_group' : IDL.Func(
        [EmptyArgs],
        [PlatformModeratorsGroupResponse],
        ['query'],
      ),
    'platform_operators' : IDL.Func(
        [PlatformOperatorsArgs],
        [PlatformOperatorsResponse],
        ['query'],
      ),
    'public_key' : IDL.Func([EmptyArgs], [PublicKeyResponse], ['query']),
    'referral_metrics' : IDL.Func(
        [EmptyArgs],
        [ReferralMetricsResponse],
        ['query'],
      ),
    'remove_platform_moderator' : IDL.Func(
        [RemovePlatformModeratorArgs],
        [RemovePlatformModeratorResponse],
        [],
      ),
    'remove_platform_operator' : IDL.Func(
        [RemovePlatformOperatorArgs],
        [RemovePlatformOperatorResponse],
        [],
      ),
    'reported_messages' : IDL.Func(
        [ReportedMessagesArgs],
        [ReportedMessagesResponse],
        ['query'],
      ),
    'search' : IDL.Func([SearchArgs], [SearchResponse], ['query']),
    'set_diamond_membership_fees' : IDL.Func(
        [SetDiamondMembershipFeesArgs],
        [SetDiamondMembershipFeesResponse],
        [],
      ),
    'set_display_name' : IDL.Func(
        [SetDisplayNameArgs],
        [SetDisplayNameResponse],
        [],
      ),
    'set_moderation_flags' : IDL.Func(
        [SetModerationFlagsArgs],
        [SetModerationFlagsResponse],
        [],
      ),
    'set_user_upgrade_concurrency' : IDL.Func(
        [SetUserUpgradeConcurrencyArgs],
        [SetUserUpgradeConcurrencyResponse],
        [],
      ),
    'set_username' : IDL.Func([SetUsernameArgs], [SetUsernameResponse], []),
    'submit_proof_of_unique_personhood' : IDL.Func(
        [SubmitProofOfUniquePersonhoodArgs],
        [SubmitProofOfUniquePersonhoodResponse],
        [],
      ),
    'suspected_bots' : IDL.Func(
        [SuspectedBotsArgs],
        [SuspectedBotsResponse],
        ['query'],
      ),
    'suspend_user' : IDL.Func([SuspendUserArgs], [SuspendUserResponse], []),
    'unsuspend_user' : IDL.Func(
        [UnsuspendUserArgs],
        [UnsuspendUserResponse],
        [],
      ),
    'update_diamond_membership_subscription' : IDL.Func(
        [UpdateDiamondMembershipSubscriptionArgs],
        [UpdateDiamondMembershipSubscriptionResponse],
        [],
      ),
    'user' : IDL.Func([UserArgs], [UserResponse], ['query']),
    'user_registration_canister' : IDL.Func(
        [EmptyArgs],
        [UserRegistrationCanisterResponse],
        ['query'],
      ),
    'users' : IDL.Func([UsersArgs], [UsersResponse], ['query']),
    'users_chit' : IDL.Func([UsersChitArgs], [UsersChitResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
