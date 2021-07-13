export default ({ IDL }) => {
  const InitArgs = IDL.Record({
    'user_wasm_module' : IDL.Vec(IDL.Nat8),
    'sms_service_principals' : IDL.Vec(IDL.Principal),
    'service_principals' : IDL.Vec(IDL.Principal),
  });
  const ConfirmPhoneNumberArgs = IDL.Record({ 'confirmation_code' : IDL.Text });
  const ConfirmPhoneNumberResponse = IDL.Variant({
    'AlreadyClaimed' : IDL.Null,
    'Success' : IDL.Null,
    'ConfirmationCodeExpired' : IDL.Null,
    'ConfirmationCodeIncorrect' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  const CreateCanisterArgs = IDL.Record({});
  const CanisterId = IDL.Principal;
  const CreateCanisterResponse = IDL.Variant({
    'UserAlreadyCreated' : IDL.Null,
    'Success' : CanisterId,
    'CreationInProgress' : IDL.Null,
    'InternalError' : IDL.Null,
    'UserUnconfirmed' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  const CurrentUserArgs = IDL.Record({});
  const PhoneNumber = IDL.Record({
    'country_code' : IDL.Nat16,
    'number' : IDL.Text,
  });
  const UserId = CanisterId;
  const CurrentUserResponse = IDL.Variant({
    'UpgradeInProgress' : IDL.Null,
    'Unconfirmed' : IDL.Record({ 'phone_number' : PhoneNumber }),
    'Confirmed' : IDL.Record({
      'username' : IDL.Text,
      'canister_creation_status' : IDL.Variant({
        'InProgress' : IDL.Null,
        'Pending' : IDL.Null,
      }),
    }),
    'ConfirmedPendingUsername' : IDL.Record({
      'canister_creation_status' : IDL.Variant({
        'InProgress' : IDL.Null,
        'Created' : IDL.Null,
        'Pending' : IDL.Null,
      }),
    }),
    'Created' : IDL.Record({
      'username' : IDL.Text,
      'user_id' : UserId,
      'account_balance' : IDL.Nat,
      'upgrade_required' : IDL.Bool,
    }),
    'UserNotFound' : IDL.Null,
  });
  const MarkAsOnlineArgs = IDL.Record({});
  const MetricsArgs = IDL.Record({});
  const TimestampMillis = IDL.Nat64;
  const MetricsResponse = IDL.Record({
    'cycles_balance' : IDL.Int64,
    'unconfirmed_user_count' : IDL.Nat64,
    'caller_id' : IDL.Principal,
    'bytes_used' : IDL.Nat64,
    'timestamp' : TimestampMillis,
    'created_user_count' : IDL.Nat64,
    'online_user_count' : IDL.Nat64,
    'confirmed_user_count' : IDL.Nat64,
    'wasm_memory_used' : IDL.Nat64,
    'cycles_transferred' : IDL.Nat,
    'active_user_count' : IDL.Nat64,
  });
  const NotifyBalanceArgs = IDL.Record({ 'balance' : IDL.Nat });
  const ResendCodeArgs = IDL.Record({});
  const ResendCodeResponse = IDL.Variant({
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
    'seconds_since_last_online' : IDL.Nat32,
  });
  const SearchResponse = IDL.Variant({
    'Success' : IDL.Record({ 'users' : IDL.Vec(UserSummary) }),
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
  const SubmitPhoneNumberArgs = IDL.Record({ 'number' : PhoneNumber });
  const SubmitPhoneNumberResponse = IDL.Variant({
    'AlreadyRegistered' : IDL.Null,
    'Success' : IDL.Null,
    'AlreadyRegisteredByOther' : IDL.Null,
    'InvalidPhoneNumber' : IDL.Null,
  });
  const TransferCyclesArgs = IDL.Record({
    'recipient' : UserId,
    'sender' : UserId,
    'amount' : IDL.Nat,
  });
  const TransferCyclesResponse = IDL.Variant({
    'BalanceExceeded' : IDL.Null,
    'Success' : IDL.Record({ 'new_balance' : IDL.Nat }),
    'UserNotFound' : IDL.Null,
    'RecipientNotFound' : IDL.Null,
  });
  const UpdateWasmArgs = IDL.Record({
    'user_wasm_module' : IDL.Vec(IDL.Nat8),
    'version' : IDL.Text,
  });
  const UpdateWasmResponse = IDL.Variant({
    'ExistingWasmHasHigherVersion' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'InvalidVersion' : IDL.Null,
  });
  const UpgradeCanisterArgs = IDL.Record({});
  const UpgradeCanisterResponse = IDL.Variant({
    'UpgradeInProgress' : IDL.Null,
    'UserNotCreated' : IDL.Null,
    'Success' : IDL.Null,
    'UpgradeNotRequired' : IDL.Null,
    'InternalError' : IDL.Null,
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
    'users' : IDL.Vec(UserId),
    'updated_since' : IDL.Opt(TimestampMillis),
  });
  const PartialUserSummary = IDL.Record({
    'username' : IDL.Opt(IDL.Text),
    'user_id' : UserId,
    'seconds_since_last_online' : IDL.Nat32,
  });
  const UsersResponse = IDL.Variant({
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'users' : IDL.Vec(PartialUserSummary),
    }),
  });
  return IDL.Service({
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
    'mark_as_online' : IDL.Func([MarkAsOnlineArgs], [], []),
    'metrics' : IDL.Func([MetricsArgs], [MetricsResponse], ['query']),
    'notify_balance' : IDL.Func([NotifyBalanceArgs], [], []),
    'resend_code' : IDL.Func([ResendCodeArgs], [ResendCodeResponse], []),
    'search' : IDL.Func([SearchArgs], [SearchResponse], ['query']),
    'set_username' : IDL.Func([SetUsernameArgs], [SetUsernameResponse], []),
    'submit_phone_number' : IDL.Func(
        [SubmitPhoneNumberArgs],
        [SubmitPhoneNumberResponse],
        [],
      ),
    'transfer_cycles' : IDL.Func(
        [TransferCyclesArgs],
        [TransferCyclesResponse],
        [],
      ),
    'update_wasm' : IDL.Func([UpdateWasmArgs], [UpdateWasmResponse], []),
    'upgrade_canister' : IDL.Func(
        [UpgradeCanisterArgs],
        [UpgradeCanisterResponse],
        [],
      ),
    'user' : IDL.Func([UserArgs], [UserResponse], ['query']),
    'users' : IDL.Func([UsersArgs], [UsersResponse], ['query']),
  });
};
export const init = ({ IDL }) => {
  const InitArgs = IDL.Record({
    'user_wasm_module' : IDL.Vec(IDL.Nat8),
    'sms_service_principals' : IDL.Vec(IDL.Principal),
    'service_principals' : IDL.Vec(IDL.Principal),
  });
  return [InitArgs];
};
