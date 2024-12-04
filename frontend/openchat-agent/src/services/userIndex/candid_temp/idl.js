export const idlFactory = ({ IDL }) => {
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
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const AwardExternalAchievementArgs = IDL.Record({
    'user_id' : UserId,
    'achievement_id' : IDL.Nat32,
  });
  const AwardExternalAchievementResponse = IDL.Variant({
    'InvalidCaller' : IDL.Null,
    'NotFound' : IDL.Null,
    'Success' : IDL.Record({ 'remaining_chit_budget' : IDL.Nat32 }),
    'AlreadyAwarded' : IDL.Null,
    'InsufficientBudget' : IDL.Null,
    'Expired' : IDL.Null,
  });
  const BotUpdatesArgs = IDL.Record({ 'updated_since' : TimestampMillis });
  const GroupPermission = IDL.Variant({
    'StartVideoCall' : IDL.Null,
    'DeleteMessages' : IDL.Null,
    'RemoveMembers' : IDL.Null,
    'UpdateGroup' : IDL.Null,
    'ReactToMessages' : IDL.Null,
    'AddMembers' : IDL.Null,
    'InviteUsers' : IDL.Null,
    'MentionAllMembers' : IDL.Null,
    'PinMessages' : IDL.Null,
    'ChangeRoles' : IDL.Null,
  });
  const CommunityPermission = IDL.Variant({
    'RemoveMembers' : IDL.Null,
    'CreatePublicChannel' : IDL.Null,
    'InviteUsers' : IDL.Null,
    'ManageUserGroups' : IDL.Null,
    'UpdateDetails' : IDL.Null,
    'CreatePrivateChannel' : IDL.Null,
    'ChangeRoles' : IDL.Null,
  });
  const MessagePermission = IDL.Variant({
    'VideoCall' : IDL.Null,
    'Giphy' : IDL.Null,
    'File' : IDL.Null,
    'Poll' : IDL.Null,
    'Text' : IDL.Null,
    'Image' : IDL.Null,
    'Prize' : IDL.Null,
    'P2pSwap' : IDL.Null,
    'Audio' : IDL.Null,
    'Crypto' : IDL.Null,
    'Video' : IDL.Null,
  });
  const SlashCommandPermissions = IDL.Record({
    'chat' : IDL.Vec(GroupPermission),
    'community' : IDL.Vec(CommunityPermission),
    'thread' : IDL.Vec(MessagePermission),
    'message' : IDL.Vec(MessagePermission),
  });
  const NumberParamChoice = IDL.Record({
    'value' : IDL.Nat16,
    'name' : IDL.Text,
  });
  const NumberParam = IDL.Record({
    'min_length' : IDL.Nat16,
    'max_length' : IDL.Nat16,
    'choices' : IDL.Vec(NumberParamChoice),
  });
  const StringParamChoice = IDL.Record({
    'value' : IDL.Text,
    'name' : IDL.Text,
  });
  const StringParam = IDL.Record({
    'min_length' : IDL.Nat16,
    'max_length' : IDL.Nat16,
    'choices' : IDL.Vec(StringParamChoice),
  });
  const SlashCommandParamType = IDL.Variant({
    'UserParam' : IDL.Null,
    'NumberParam' : NumberParam,
    'StringParam' : StringParam,
    'BooleanParam' : IDL.Null,
  });
  const SlashCommandParam = IDL.Record({
    'name' : IDL.Text,
    'description' : IDL.Opt(IDL.Text),
    'required' : IDL.Bool,
    'placeholder' : IDL.Opt(IDL.Text),
    'param_type' : SlashCommandParamType,
  });
  const SlashCommandSchema = IDL.Record({
    'permissions' : SlashCommandPermissions,
    'name' : IDL.Text,
    'description' : IDL.Opt(IDL.Text),
    'params' : IDL.Vec(SlashCommandParam),
  });
  const BotUpdatesResponse = IDL.Variant({
    'Success' : IDL.Record({
      'deleted' : IDL.Vec(UserId),
      'timestamp' : TimestampMillis,
      'added_or_updated' : IDL.Vec(
        IDL.Record({
          'id' : UserId,
          'endpoint' : IDL.Text,
          'owner' : UserId,
          'name' : IDL.Text,
          'description' : IDL.Text,
          'last_updated' : TimestampMillis,
          'avatar_id' : IDL.Opt(IDL.Nat),
          'commands' : IDL.Vec(SlashCommandSchema),
        })
      ),
    }),
    'SuccessNoUpdates' : IDL.Null,
  });
  const CheckUsernameArgs = IDL.Record({
    'username' : IDL.Text,
    'is_bot' : IDL.Bool,
  });
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
    'SuccessV2' : IDL.Record({
      'all_time' : IDL.Vec(ChitUserBalance),
      'last_month' : IDL.Vec(ChitUserBalance),
      'this_month' : IDL.Vec(ChitUserBalance),
    }),
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
  const ExploreBotsArgs = IDL.Record({
    'page_size' : IDL.Nat8,
    'page_index' : IDL.Nat32,
    'search_term' : IDL.Opt(IDL.Text),
  });
  const BotMatch = IDL.Record({
    'id' : UserId,
    'owner' : UserId,
    'name' : IDL.Text,
    'description' : IDL.Text,
    'score' : IDL.Nat32,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'banner_id' : IDL.Opt(IDL.Nat),
    'commands' : IDL.Vec(SlashCommandSchema),
  });
  const ExploreBotsResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat8,
    'Success' : IDL.Record({
      'total' : IDL.Nat32,
      'matches' : IDL.Vec(BotMatch),
    }),
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
  });
  const ExternalAchievementsArgs = IDL.Record({
    'updates_since' : TimestampMillis,
  });
  const ExternalAchievement = IDL.Record({
    'id' : IDL.Nat32,
    'url' : IDL.Text,
    'expires' : TimestampMillis,
    'name' : IDL.Text,
    'budget_exhausted' : IDL.Bool,
    'chit_reward' : IDL.Nat32,
  });
  const ExternalAchievementsResponse = IDL.Variant({
    'Success' : IDL.Record({
      'last_updated' : TimestampMillis,
      'added_or_updated' : IDL.Vec(ExternalAchievement),
    }),
    'SuccessNoUpdates' : IDL.Null,
  });
  const PlatformModeratorsResponse = IDL.Variant({
    'Success' : IDL.Record({ 'users' : IDL.Vec(UserId) }),
  });
  const ChatId = CanisterId;
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
  const RegisterBotArgs = IDL.Record({
    'principal' : IDL.Principal,
    'endpoint' : IDL.Text,
    'owner' : UserId,
    'name' : IDL.Text,
    'description' : IDL.Text,
    'commands' : IDL.Vec(SlashCommandSchema),
    'avatar' : IDL.Opt(IDL.Text),
  });
  const RegisterBotResponse = IDL.Variant({ 'Success' : IDL.Null });
  const RegisterExternalAchievementArgs = IDL.Record({
    'id' : IDL.Nat32,
    'url' : IDL.Text,
    'expires' : TimestampMillis,
    'logo' : IDL.Text,
    'name' : IDL.Text,
    'canister_id' : CanisterId,
    'max_awards' : IDL.Nat32,
    'chit_reward' : IDL.Nat32,
    'submitted_by' : UserId,
  });
  const RegisterExternalAchievementResponse = IDL.Variant({
    'Success' : IDL.Null,
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
  const UserSummaryStable = IDL.Record({
    'username' : IDL.Text,
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
    'add_referral_codes' : IDL.Func(
        [AddReferralCodesArgs],
        [AddReferralCodesResponse],
        [],
      ),
    'award_external_achievement' : IDL.Func(
        [AwardExternalAchievementArgs],
        [AwardExternalAchievementResponse],
        [],
      ),
    'bot_updates' : IDL.Func([BotUpdatesArgs], [BotUpdatesResponse], ['query']),
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
    'explore_bots' : IDL.Func(
        [ExploreBotsArgs],
        [ExploreBotsResponse],
        ['query'],
      ),
    'external_achievements' : IDL.Func(
        [ExternalAchievementsArgs],
        [ExternalAchievementsResponse],
        ['query'],
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
    'register_bot' : IDL.Func([RegisterBotArgs], [RegisterBotResponse], []),
    'register_external_achievement' : IDL.Func(
        [RegisterExternalAchievementArgs],
        [RegisterExternalAchievementResponse],
        [],
      ),
    'search' : IDL.Func([SearchArgs], [SearchResponse], ['query']),
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
