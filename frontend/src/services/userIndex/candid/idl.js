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
  const CurrentUserResponse = IDL.Variant({
    'Success' : IDL.Record({
      'username' : IDL.Text,
      'phone_status' : PhoneStatus,
      'wasm_version' : Version,
      'icp_account' : AccountIdentifier,
      'user_id' : UserId,
      'avatar_id' : IDL.Opt(IDL.Nat),
      'canister_upgrade_status' : CanisterUpgradeStatus,
      'open_storage_limit_bytes' : IDL.Nat64,
    }),
    'UserNotFound' : IDL.Null,
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
    'user_id' : UserId,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'seconds_since_last_online' : IDL.Nat32,
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
    'user_id' : UserId,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'seconds_since_last_online' : IDL.Nat32,
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
