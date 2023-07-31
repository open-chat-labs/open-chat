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
  const Version = IDL.Record({
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
  const DiamondMembershipPlanDuration = IDL.Variant({
    'OneYear' : IDL.Null,
    'ThreeMonths' : IDL.Null,
    'OneMonth' : IDL.Null,
  });
  const DiamondMembershipDetails = IDL.Record({
    'recurring' : IDL.Opt(DiamondMembershipPlanDuration),
    'expires_at' : TimestampMillis,
  });
  const CurrentUserResponse = IDL.Variant({
    'Success' : IDL.Record({
      'username' : IDL.Text,
      'wasm_version' : Version,
      'icp_account' : AccountIdentifier,
      'referrals' : IDL.Vec(UserId),
      'user_id' : UserId,
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
  const MarkSuspectedBotArgs = IDL.Record({});
  const MarkSuspectedBotResponse = IDL.Variant({ 'Success' : IDL.Null });
  const Cryptocurrency = IDL.Variant({
    'InternetComputer' : IDL.Null,
    'CHAT' : IDL.Null,
    'SNS1' : IDL.Null,
    'KINIC' : IDL.Null,
    'CKBTC' : IDL.Null,
    'Other' : IDL.Text,
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
    'Success' : DiamondMembershipDetails,
    'PriceMismatch' : IDL.Null,
    'TransferFailed' : IDL.Text,
    'InternalError' : IDL.Text,
    'CannotExtend' : IDL.Record({
      'can_extend_at' : TimestampMillis,
      'diamond_membership_expires_at' : TimestampMillis,
    }),
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
  const ReferralLeaderboardArgs = IDL.Record({
    'count' : IDL.Nat32,
    'filter' : IDL.Opt(
      IDL.Variant({
        'CurrentMonth' : IDL.Null,
        'Month' : IDL.Record({ 'month' : IDL.Nat8, 'year' : IDL.Nat32 }),
      })
    ),
  });
  const ReferralStats = IDL.Record({
    'username' : IDL.Text,
    'total_users' : IDL.Nat32,
    'user_id' : UserId,
    'diamond_members' : IDL.Nat32,
    'total_rewards_e8s' : IDL.Nat64,
  });
  const ReferralLeaderboardResponse = IDL.Variant({
    'AllTime' : IDL.Vec(ReferralStats),
    'Month' : IDL.Record({
      'month' : IDL.Nat8,
      'year' : IDL.Nat32,
      'results' : IDL.Vec(ReferralStats),
    }),
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
  const SearchArgs = IDL.Record({
    'max_results' : IDL.Nat8,
    'search_term' : IDL.Text,
  });
  const UserSummary = IDL.Record({
    'username' : IDL.Text,
    'diamond_member' : IDL.Bool,
    'user_id' : UserId,
    'is_bot' : IDL.Bool,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'seconds_since_last_online' : IDL.Nat32,
    'suspended' : IDL.Bool,
  });
  const SearchResponse = IDL.Variant({
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'users' : IDL.Vec(UserSummary),
    }),
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
  });
  const PartialUserSummary = IDL.Record({
    'username' : IDL.Opt(IDL.Text),
    'diamond_member' : IDL.Bool,
    'user_id' : UserId,
    'is_bot' : IDL.Bool,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'suspended' : IDL.Bool,
  });
  const UsersResponse = IDL.Variant({
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'users' : IDL.Vec(PartialUserSummary),
    }),
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
    'current_user' : IDL.Func([EmptyArgs], [CurrentUserResponse], ['query']),
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
    'referral_leaderboard' : IDL.Func(
        [ReferralLeaderboardArgs],
        [ReferralLeaderboardResponse],
        ['query'],
      ),
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
    'search' : IDL.Func([SearchArgs], [SearchResponse], ['query']),
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
    'user' : IDL.Func([UserArgs], [UserResponse], ['query']),
    'user_registration_canister' : IDL.Func(
        [EmptyArgs],
        [UserRegistrationCanisterResponse],
        ['query'],
      ),
    'users' : IDL.Func([UsersArgs], [UsersResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
