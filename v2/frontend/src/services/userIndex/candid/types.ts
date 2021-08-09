import type { Principal } from '@dfinity/principal';
export type CanisterId = Principal;
export interface ConfirmPhoneNumberArgs { 'confirmation_code' : string }
export type ConfirmPhoneNumberResponse = { 'AlreadyClaimed' : null } |
  { 'Success' : null } |
  { 'ConfirmationCodeExpired' : null } |
  { 'ConfirmationCodeIncorrect' : null } |
  { 'UserNotFound' : null };
export type CreateCanisterArgs = {};
export type CreateCanisterResponse = { 'UserAlreadyCreated' : null } |
  { 'Success' : CanisterId } |
  { 'CreationInProgress' : null } |
  { 'InternalError' : null } |
  { 'UserUnconfirmed' : null } |
  { 'UserNotFound' : null };
export type CurrentUserArgs = {};
export type CurrentUserResponse = {
    'Unconfirmed' : { 'phone_number' : PhoneNumber }
  } |
  {
    'Confirmed' : {
      'username' : string,
      'canister_creation_status' : { 'InProgress' : null } |
        { 'Created' : null } |
        { 'Pending' : null },
    }
  } |
  {
    'ConfirmedPendingUsername' : {
      'canister_creation_status' : { 'InProgress' : null } |
        { 'Created' : null } |
        { 'Pending' : null },
    }
  } |
  {
    'Created' : {
      'username' : string,
      'user_id' : UserId,
      'canister_upgrade_status' : { 'Required' : null } |
        { 'NotRequired' : null } |
        { 'InProgress' : null },
      'account_balance' : bigint,
    }
  } |
  { 'UserNotFound' : null };
export interface InitArgs {
  'test_mode' : boolean,
  'user_wasm_module' : Array<number>,
  'sms_service_principals' : Array<Principal>,
  'service_principals' : Array<Principal>,
}
export type MarkAsOnlineArgs = {};
export type MarkAsOnlineResponse = { 'Success' : null } |
  { 'UserNotFound' : null };
export type MetricsArgs = {};
export interface MetricsResponse {
  'cycles_balance' : bigint,
  'unconfirmed_user_count' : bigint,
  'caller_id' : Principal,
  'bytes_used' : bigint,
  'timestamp' : TimestampMillis,
  'created_user_count' : bigint,
  'online_user_count' : bigint,
  'confirmed_user_count' : bigint,
  'wasm_memory_used' : bigint,
  'cycles_transferred' : bigint,
  'active_user_count' : bigint,
}
export type Milliseconds = bigint;
export interface NotifyBalanceArgs { 'balance' : bigint }
export interface PartialUserSummary {
  'username' : [] | [string],
  'user_id' : UserId,
  'seconds_since_last_online' : number,
}
export interface PhoneNumber { 'country_code' : number, 'number' : string }
export interface RemoveSmsMessagesArgs { 'up_to_sms_index' : bigint }
export type RemoveSmsMessagesResponse = { 'NotAuthorized' : null } |
  { 'Success' : null };
export type ResendCodeArgs = {};
export type ResendCodeResponse = { 'AlreadyClaimed' : null } |
  { 'Success' : null } |
  { 'UserNotFound' : null };
export interface SearchArgs { 'max_results' : number, 'search_term' : string }
export type SearchResponse = { 'Success' : { 'users' : Array<UserSummary> } };
export interface SetUsernameArgs { 'username' : string }
export type SetUsernameResponse = { 'UsernameTaken' : null } |
  { 'UsernameTooShort' : number } |
  { 'UsernameInvalid' : null } |
  { 'UsernameTooLong' : number } |
  { 'Success' : null } |
  { 'UserUnconfirmed' : null } |
  { 'UserNotFound' : null };
export interface SmsMessagesArgs {
  'max_results' : bigint,
  'from_index' : bigint,
}
export type SmsMessagesResponse = {
    'Success' : {
      'notifications' : Array<SmsNotification>,
      'latest_index' : bigint,
    }
  };
export interface SmsNotification { 'message' : string, 'phone_number' : string }
export interface SubmitPhoneNumberArgs { 'phone_number' : PhoneNumber }
export type SubmitPhoneNumberResponse = { 'AlreadyRegistered' : null } |
  { 'Success' : null } |
  { 'AlreadyRegisteredByOther' : null } |
  { 'InvalidPhoneNumber' : null };
export type TimestampMillis = bigint;
export interface TransferCyclesArgs {
  'recipient' : UserId,
  'sender' : UserId,
  'amount' : bigint,
}
export type TransferCyclesResponse = { 'BalanceExceeded' : null } |
  { 'Success' : { 'new_balance' : bigint } } |
  { 'UserNotFound' : null } |
  { 'RecipientNotFound' : null };
export interface UpdateWasmArgs {
  'user_wasm_module' : Array<number>,
  'version' : string,
}
export type UpdateWasmResponse = { 'NotAuthorized' : null } |
  { 'Success' : null } |
  { 'VersionNotHigher' : null } |
  { 'InvalidVersion' : null };
export type UpgradeCanisterArgs = {};
export type UpgradeCanisterResponse = { 'UpgradeInProgress' : null } |
  { 'UserNotCreated' : null } |
  { 'Success' : null } |
  { 'UpgradeNotRequired' : null } |
  { 'InternalError' : null } |
  { 'UserNotFound' : null };
export interface UserArgs {
  'username' : [] | [string],
  'user_id' : [] | [UserId],
}
export type UserId = CanisterId;
export type UserResponse = { 'Success' : UserSummary } |
  { 'UserNotFound' : null };
export interface UserSummary {
  'username' : string,
  'user_id' : UserId,
  'seconds_since_last_online' : number,
}
export interface UsersArgs {
  'users' : Array<UserId>,
  'updated_since' : [] | [TimestampMillis],
}
export type UsersResponse = {
    'Success' : {
      'timestamp' : TimestampMillis,
      'users' : Array<PartialUserSummary>,
    }
  };
export interface _SERVICE {
  'confirm_phone_number' : (arg_0: ConfirmPhoneNumberArgs) => Promise<
      ConfirmPhoneNumberResponse
    >,
  'create_canister' : (arg_0: CreateCanisterArgs) => Promise<
      CreateCanisterResponse
    >,
  'current_user' : (arg_0: CurrentUserArgs) => Promise<CurrentUserResponse>,
  'mark_as_online' : (arg_0: MarkAsOnlineArgs) => Promise<MarkAsOnlineResponse>,
  'metrics' : (arg_0: MetricsArgs) => Promise<MetricsResponse>,
  'notify_balance' : (arg_0: NotifyBalanceArgs) => Promise<undefined>,
  'remove_sms_messages' : (arg_0: RemoveSmsMessagesArgs) => Promise<
      RemoveSmsMessagesResponse
    >,
  'resend_code' : (arg_0: ResendCodeArgs) => Promise<ResendCodeResponse>,
  'search' : (arg_0: SearchArgs) => Promise<SearchResponse>,
  'set_username' : (arg_0: SetUsernameArgs) => Promise<SetUsernameResponse>,
  'sms_messages' : (arg_0: SmsMessagesArgs) => Promise<SmsMessagesResponse>,
  'submit_phone_number' : (arg_0: SubmitPhoneNumberArgs) => Promise<
      SubmitPhoneNumberResponse
    >,
  'transfer_cycles' : (arg_0: TransferCyclesArgs) => Promise<
      TransferCyclesResponse
    >,
  'update_wasm' : (arg_0: UpdateWasmArgs) => Promise<UpdateWasmResponse>,
  'upgrade_canister' : (arg_0: UpgradeCanisterArgs) => Promise<
      UpgradeCanisterResponse
    >,
  'user' : (arg_0: UserArgs) => Promise<UserResponse>,
  'users' : (arg_0: UsersArgs) => Promise<UsersResponse>,
}
