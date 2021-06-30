export default ({ IDL }) => {
  const ConfirmPhoneNumberRequest = IDL.Record({
    'confirmation_code' : IDL.Text,
  });
  const ConfirmPhoneNumberResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'AlreadyClaimed' : IDL.Null,
    'Success' : IDL.Null,
    'ConfirmationCodeExpired' : IDL.Null,
    'ConfirmationCodeIncorrect' : IDL.Null,
  });
  const CreateCanisterRequest = IDL.Record({});
  const CurrentUserRequest = IDL.Record({});
  const Milliseconds = IDL.Nat64;
  const PhoneNumber = IDL.Record({
    'country_code' : IDL.Nat16,
    'number' : IDL.Text,
  });
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const CurrentUserResponse = IDL.Variant({
    'UpgradeInProgress' : IDL.Null,
    'Unconfirmed' : IDL.Record({
      'time_until_resend_code_permitted' : Milliseconds,
      'phone_number' : PhoneNumber,
    }),
    'Confirmed' : IDL.Record({
      'canister_creation_in_progress' : IDL.Bool,
      'username' : IDL.Text,
    }),
    'ConfirmedPendingUsername' : IDL.Record({
      'canister_creation_in_progress' : IDL.Bool,
    }),
    'Created' : IDL.Record({
      'username' : IDL.Text,
      'user_id' : UserId,
      'account_balance' : IDL.Nat,
      'upgrade_required' : IDL.Bool,
    }),
    'UserNotFound' : IDL.Null,
  });
  const MarkAsOnlineRequest = IDL.Record({});
  const MetricsRequest = IDL.Record({});
  const TimestampMillis = IDL.Nat64;
  const Metrics = IDL.Record({
    'user_count' : IDL.Nat64,
    'cycles_balance' : IDL.Int64,
    'caller_id' : IDL.Principal,
    'bytes_used' : IDL.Nat64,
    'timestamp' : TimestampMillis,
    'online_user_count' : IDL.Nat64,
    'wasm_memory_used' : IDL.Nat64,
    'cycles_transferred' : IDL.Nat,
    'active_user_count' : IDL.Nat64,
  });
  const BalanceNotification = IDL.Record({ 'balance' : IDL.Nat });
  const ResendCodeRequest = IDL.Record({});
  const ResendCodeResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'AlreadyClaimed' : IDL.Null,
    'Success' : IDL.Null,
    'CodeNotExpiredYet' : IDL.Record({
      'time_until_resend_code_permitted' : Milliseconds,
    }),
  });
  const SearchRequest = IDL.Record({
    'max_results' : IDL.Nat8,
    'search_term' : IDL.Text,
  });
  const UserSummary = IDL.Record({
    'username' : IDL.Text,
    'last_online' : Milliseconds,
    'user_id' : UserId,
  });
  const SearchResponse = IDL.Variant({
    'Success' : IDL.Record({ 'users' : IDL.Vec(UserSummary) }),
  });
  const SetUsernameRequest = IDL.Record({ 'username' : IDL.Text });
  const SetUsernameResponse = IDL.Variant({
    'SuccessNoChange' : IDL.Null,
    'UsernameTaken' : IDL.Null,
    'UsernameTooShort' : IDL.Nat16,
    'UsernameInvalid' : IDL.Null,
    'UsernameTooLong' : IDL.Nat16,
    'Success' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  const SubmitPhoneNumberRequest = IDL.Record({ 'number' : PhoneNumber });
  const SubmitPhoneNumberResponse = IDL.Variant({
    'AlreadyRegistered' : IDL.Null,
    'Success' : IDL.Null,
    'AlreadyRegisteredByOther' : IDL.Null,
    'AlreadyRegisteredButUnclaimed' : IDL.Record({
      'time_until_resend_code_permitted' : IDL.Opt(Milliseconds),
    }),
    'InvalidPhoneNumber' : IDL.Null,
  });
  const TransferCyclesRequest = IDL.Record({
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
  const UpdateWasmRequest = IDL.Record({
    'wasm' : IDL.Vec(IDL.Nat8),
    'version' : IDL.Text,
  });
  const UpgradeCanisterRequest = IDL.Record({});
  const UserRequest = IDL.Record({
    'username' : IDL.Opt(IDL.Text),
    'user_id' : IDL.Opt(UserId),
  });
  const UserResponse = IDL.Variant({
    'Success' : UserSummary,
    'UserNotFound' : IDL.Null,
  });
  const UsersRequest = IDL.Record({
    'users' : IDL.Vec(UserId),
    'updated_since' : IDL.Opt(TimestampMillis),
  });
  const UsersResponse = IDL.Variant({
    'Success' : IDL.Record({
      'timestamp' : TimestampMillis,
      'users' : IDL.Vec(UserSummary),
    }),
  });
  return IDL.Service({
    'confirm_phone_number' : IDL.Func(
        [ConfirmPhoneNumberRequest],
        [ConfirmPhoneNumberResponse],
        [],
      ),
    'create_canister' : IDL.Func([CreateCanisterRequest], [], []),
    'current_user' : IDL.Func(
        [CurrentUserRequest],
        [CurrentUserResponse],
        ['query'],
      ),
    'mark_as_online' : IDL.Func([MarkAsOnlineRequest], [], []),
    'metrics' : IDL.Func([MetricsRequest], [Metrics], ['query']),
    'notify_balance' : IDL.Func([BalanceNotification], [], []),
    'resend_code' : IDL.Func([ResendCodeRequest], [ResendCodeResponse], []),
    'search' : IDL.Func([SearchRequest], [SearchResponse], ['query']),
    'set_username' : IDL.Func([SetUsernameRequest], [SetUsernameResponse], []),
    'submit_phone_number' : IDL.Func(
        [SubmitPhoneNumberRequest],
        [SubmitPhoneNumberResponse],
        [],
      ),
    'transfer_cycles' : IDL.Func(
        [TransferCyclesRequest],
        [TransferCyclesResponse],
        [],
      ),
    'update_wasm' : IDL.Func([UpdateWasmRequest], [], []),
    'upgrade_canister' : IDL.Func([UpgradeCanisterRequest], [], []),
    'user' : IDL.Func([UserRequest], [UserResponse], ['query']),
    'users' : IDL.Func([UsersRequest], [UsersResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
