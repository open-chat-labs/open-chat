export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const AddSuperAdminArgs = IDL.Record({ 'user_id' : UserId });
  const AddSuperAdminResponse = IDL.Variant({
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
    'AlreadySuperAdmin' : IDL.Null,
  });
  const CheckUsernameArgs = IDL.Record({ 'username' : IDL.Text });
  const CheckUsernameResponse = IDL.Variant({
    'UsernameTaken' : IDL.Null,
    'UsernameTooShort' : IDL.Nat16,
    'UsernameInvalid' : IDL.Null,
    'UsernameTooLong' : IDL.Nat16,
    'Success' : IDL.Null,
  });
  const ConfirmPhoneNumberArgs = IDL.Record({ 'confirmation_code' : IDL.Text });
  const SuccessResult = IDL.Record({ 'open_storage_limit_bytes' : IDL.Nat64 });
  const ConfirmPhoneNumberResponse = IDL.Variant({
    'AlreadyClaimed' : IDL.Null,
    'Success' : SuccessResult,
    'ConfirmationCodeExpired' : IDL.Null,
    'ConfirmationCodeIncorrect' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  const CreateChallengeArgs = IDL.Record({});
  const ChallengeKey = IDL.Nat32;
  const Challenge = IDL.Record({
    'key' : ChallengeKey,
    'png_base64' : IDL.Text,
  });
  const CreateChallengeResponse = IDL.Variant({
    'Throttled' : IDL.Null,
    'Success' : Challenge,
  });
  const CurrentUserArgs = IDL.Record({});
  const TimestampMillis = IDL.Nat64;
  const PhoneNumber = IDL.Record({
    'country_code' : IDL.Nat16,
    'number' : IDL.Text,
  });
  const UnconfirmedPhoneNumberState = IDL.Record({
    'valid_until' : TimestampMillis,
    'phone_number' : PhoneNumber,
  });
  const PhoneStatus = IDL.Variant({
    'Unconfirmed' : UnconfirmedPhoneNumberState,
    'None' : IDL.Null,
    'Confirmed' : IDL.Null,
  });
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
      'phone_status' : PhoneStatus,
      'wasm_version' : Version,
      'icp_account' : AccountIdentifier,
      'referrals' : IDL.Vec(UserId),
      'user_id' : UserId,
      'avatar_id' : IDL.Opt(IDL.Nat),
      'is_suspected_bot' : IDL.Bool,
      'canister_upgrade_status' : CanisterUpgradeStatus,
      'is_super_admin' : IDL.Bool,
      'suspension_details' : IDL.Opt(SuspensionDetails),
      'open_storage_limit_bytes' : IDL.Nat64,
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
    'CKBTC' : IDL.Null,
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
  const ChallengeAttempt = IDL.Record({
    'key' : ChallengeKey,
    'chars' : IDL.Text,
  });
  const RegisterUserArgs = IDL.Record({
    'username' : IDL.Text,
    'referred_by' : IDL.Opt(UserId),
    'challenge_attempt' : ChallengeAttempt,
  });
  const RegisterUserResponse = IDL.Variant({
    'UsernameTaken' : IDL.Null,
    'UsernameTooShort' : IDL.Nat16,
    'UsernameInvalid' : IDL.Null,
    'AlreadyRegistered' : IDL.Null,
    'UserLimitReached' : IDL.Null,
    'UsernameTooLong' : IDL.Nat16,
    'Success' : UserId,
    'ChallengeFailed' : IDL.Null,
    'InternalError' : IDL.Text,
    'CyclesBalanceTooLow' : IDL.Null,
  });
  const RemoveSuperAdminArgs = IDL.Record({ 'user_id' : UserId });
  const RemoveSuperAdminResponse = IDL.Variant({
    'Success' : IDL.Null,
    'NotSuperAdmin' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const ResendCodeArgs = IDL.Record({});
  const ResendCodeResponse = IDL.Variant({
    'PhoneNumberNotSubmitted' : IDL.Null,
    'Success' : IDL.Null,
    'PhoneNumberAlreadyConfirmed' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
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
  const SetUsernameArgs = IDL.Record({ 'username' : IDL.Text });
  const SetUsernameResponse = IDL.Variant({
    'UsernameTaken' : IDL.Null,
    'UsernameTooShort' : IDL.Nat16,
    'UsernameInvalid' : IDL.Null,
    'UsernameTooLong' : IDL.Nat16,
    'Success' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  const SubmitPhoneNumberArgs = IDL.Record({ 'phone_number' : PhoneNumber });
  const SubmitPhoneNumberResponse = IDL.Variant({
    'AlreadyRegistered' : IDL.Null,
    'Success' : IDL.Null,
    'AlreadyRegisteredByOther' : IDL.Null,
    'InvalidPhoneNumber' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  const SuperAdminsArgs = IDL.Record({});
  const SuperAdminsResponse = IDL.Variant({
    'Success' : IDL.Record({ 'users' : IDL.Vec(UserId) }),
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
  const UpgradeStorageArgs = IDL.Record({
    'new_storage_limit_bytes' : IDL.Nat64,
  });
  const Tokens = IDL.Record({ 'e8s' : IDL.Nat64 });
  const ICP = Tokens;
  const UpgradeStorageResponse = IDL.Variant({
    'SuccessNoChange' : IDL.Null,
    'Success' : IDL.Null,
    'PaymentNotFound' : IDL.Null,
    'PaymentInsufficient' : IDL.Record({
      'amount_required' : ICP,
      'account_balance' : ICP,
    }),
    'InternalError' : IDL.Text,
    'StorageLimitExceeded' : IDL.Nat64,
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
    'add_super_admin' : IDL.Func(
        [AddSuperAdminArgs],
        [AddSuperAdminResponse],
        [],
      ),
    'check_username' : IDL.Func(
        [CheckUsernameArgs],
        [CheckUsernameResponse],
        ['query'],
      ),
    'confirm_phone_number' : IDL.Func(
        [ConfirmPhoneNumberArgs],
        [ConfirmPhoneNumberResponse],
        [],
      ),
    'create_challenge' : IDL.Func(
        [CreateChallengeArgs],
        [CreateChallengeResponse],
        [],
      ),
    'current_user' : IDL.Func(
        [CurrentUserArgs],
        [CurrentUserResponse],
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
    'register_user' : IDL.Func([RegisterUserArgs], [RegisterUserResponse], []),
    'remove_super_admin' : IDL.Func(
        [RemoveSuperAdminArgs],
        [RemoveSuperAdminResponse],
        [],
      ),
    'resend_code' : IDL.Func([ResendCodeArgs], [ResendCodeResponse], []),
    'search' : IDL.Func([SearchArgs], [SearchResponse], ['query']),
    'set_username' : IDL.Func([SetUsernameArgs], [SetUsernameResponse], []),
    'submit_phone_number' : IDL.Func(
        [SubmitPhoneNumberArgs],
        [SubmitPhoneNumberResponse],
        [],
      ),
    'super_admins' : IDL.Func(
        [SuperAdminsArgs],
        [SuperAdminsResponse],
        ['query'],
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
    'upgrade_storage' : IDL.Func(
        [UpgradeStorageArgs],
        [UpgradeStorageResponse],
        [],
      ),
    'user' : IDL.Func([UserArgs], [UserResponse], ['query']),
    'users' : IDL.Func([UsersArgs], [UsersResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
