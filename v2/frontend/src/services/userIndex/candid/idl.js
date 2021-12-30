export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const AddSuperAdminArgs = IDL.Record({ 'user_id' : UserId });
  const AddSuperAdminResponse = IDL.Variant({
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
    'AlreadySuperAdmin' : IDL.Null,
  });
  const ConfirmPhoneNumberArgs = IDL.Record({ 'confirmation_code' : IDL.Text });
  const ConfirmPhoneNumberResponse = IDL.Variant({
    'PhoneNumberNotSubmitted' : IDL.Null,
    'AlreadyClaimed' : IDL.Null,
    'Success' : IDL.Null,
    'ConfirmationCodeExpired' : IDL.Null,
    'ConfirmationCodeIncorrect' : IDL.Null,
  });
  const CreateCanisterArgs = IDL.Record({});
  const CreateCanisterResponse = IDL.Variant({
    'UserAlreadyCreated' : IDL.Null,
    'Success' : CanisterId,
    'CreationInProgress' : IDL.Null,
    'InternalError' : IDL.Text,
    'UserUnconfirmed' : IDL.Null,
    'UserNotFound' : IDL.Null,
    'CyclesBalanceTooLow' : IDL.Null,
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
  const Cycles = IDL.Nat;
  const UnconfirmedCyclesFeeState = IDL.Record({
    'valid_until' : TimestampMillis,
    'amount' : Cycles,
  });
  const UnconfirmedUserState = IDL.Variant({
    'PhoneNumber' : UnconfirmedPhoneNumberState,
    'CyclesFee' : UnconfirmedCyclesFeeState,
  });
  const CanisterCreationStatus = IDL.Variant({
    'InProgress' : IDL.Null,
    'Created' : IDL.Null,
    'Pending' : IDL.Null,
  });
  const ConfirmationState = IDL.Variant({
    'PhoneNumber' : PhoneNumber,
    'CyclesFee' : Cycles,
  });
  const Cryptocurrency = IDL.Variant({ 'ICP' : IDL.Null, 'Cycles' : IDL.Null });
  const CryptocurrencyAccount = IDL.Record({
    'currency' : Cryptocurrency,
    'address' : IDL.Text,
  });
  const CanisterUpgradeStatus = IDL.Variant({
    'Required' : IDL.Null,
    'NotRequired' : IDL.Null,
    'InProgress' : IDL.Null,
  });
  const CurrentUserResponse = IDL.Variant({
    'Unconfirmed' : IDL.Record({ 'state' : UnconfirmedUserState }),
    'Confirmed' : IDL.Record({
      'username' : IDL.Text,
      'canister_creation_status' : CanisterCreationStatus,
      'confirmation_state' : ConfirmationState,
    }),
    'ConfirmedPendingUsername' : IDL.Record({
      'canister_creation_status' : CanisterCreationStatus,
      'confirmation_state' : ConfirmationState,
    }),
    'Created' : IDL.Record({
      'username' : IDL.Text,
      'user_id' : UserId,
      'cryptocurrency_accounts' : IDL.Vec(CryptocurrencyAccount),
      'avatar_id' : IDL.Opt(IDL.Nat),
      'canister_upgrade_status' : CanisterUpgradeStatus,
    }),
    'UserNotFound' : IDL.Null,
  });
  const GenerateRegistrationFeeArgs = IDL.Record({});
  const GenerateRegistrationFeeResponse = IDL.Variant({
    'AlreadyRegistered' : IDL.Null,
    'Success' : IDL.Record({
      'valid_until' : TimestampMillis,
      'amount' : Cycles,
    }),
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
    'AlreadyClaimed' : IDL.Null,
    'Success' : IDL.Null,
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
    'UserUnconfirmed' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  const SubmitPhoneNumberArgs = IDL.Record({ 'phone_number' : PhoneNumber });
  const SubmitPhoneNumberResponse = IDL.Variant({
    'AlreadyRegistered' : IDL.Null,
    'UserLimitReached' : IDL.Null,
    'Success' : IDL.Null,
    'AlreadyRegisteredByOther' : IDL.Null,
    'InvalidPhoneNumber' : IDL.Null,
  });
  const SuperAdminsArgs = IDL.Record({});
  const SuperAdminsResponse = IDL.Variant({
    'Success' : IDL.Record({ 'users' : IDL.Vec(UserId) }),
  });
  const UpgradeCanisterArgs = IDL.Record({});
  const UpgradeCanisterResponse = IDL.Variant({
    'UpgradeInProgress' : IDL.Null,
    'UserNotCreated' : IDL.Null,
    'Success' : IDL.Null,
    'UpgradeNotRequired' : IDL.Null,
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
    'confirm_phone_number' : IDL.Func(
        [ConfirmPhoneNumberArgs],
        [ConfirmPhoneNumberResponse],
        [],
      ),
    'create_canister' : IDL.Func(
        [CreateCanisterArgs],
        [CreateCanisterResponse],
        [],
      ),
    'current_user' : IDL.Func(
        [CurrentUserArgs],
        [CurrentUserResponse],
        ['query'],
      ),
    'generate_registration_fee' : IDL.Func(
        [GenerateRegistrationFeeArgs],
        [GenerateRegistrationFeeResponse],
        [],
      ),
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
    'upgrade_canister' : IDL.Func(
        [UpgradeCanisterArgs],
        [UpgradeCanisterResponse],
        [],
      ),
    'user' : IDL.Func([UserArgs], [UserResponse], ['query']),
    'users' : IDL.Func([UsersArgs], [UsersResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
