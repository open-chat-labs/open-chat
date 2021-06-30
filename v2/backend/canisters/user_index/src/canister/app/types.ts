import type { Principal } from '@dfinity/agent';
export interface BalanceNotification {
  'balance' : bigint,
};
export type CanisterId = Principal;
export interface ConfirmPhoneNumberRequest { 'confirmation_code' : string };
export type ConfirmPhoneNumberResponse = { 'NotFound' : null } |
  { 'AlreadyClaimed' : null } |
  { 'Success' : null } |
  { 'ConfirmationCodeExpired' : null } |
  { 'ConfirmationCodeIncorrect' : null };
export type CreateCanisterRequest = {};
export type CurrentUserRequest = {};
export type CurrentUserResponse = { 'UpgradeInProgress' : null } |
  {
    'Unconfirmed' : {
      'time_until_resend_code_permitted' : Milliseconds,
      'phone_number' : PhoneNumber,
    }
  } |
  {
    'Confirmed' : {
      'canister_creation_in_progress' : boolean,
      'username' : string,
    }
  } |
  {
    'ConfirmedPendingUsername' : { 'canister_creation_in_progress' : boolean }
  } |
  {
    'Created' : {
      'username' : string,
      'user_id' : UserId,
      'account_balance' : bigint,
      'upgrade_required' : boolean,
    }
  } |
  { 'UserNotFound' : null };
export type MarkAsOnlineRequest = {};
export interface Metrics {
  'user_count' : bigint,
  'cycles_balance' : bigint,
  'caller_id' : Principal,
  'bytes_used' : bigint,
  'timestamp' : TimestampMillis,
  'online_user_count' : bigint,
  'wasm_memory_used' : bigint,
  'cycles_transferred' : bigint,
  'active_user_count' : bigint,
};
export type MetricsRequest = {};
export type Milliseconds = bigint;
export interface PhoneNumber { 'country_code' : number, 'number' : string };
export type ResendCodeRequest = {};
export type ResendCodeResponse = { 'NotFound' : null } |
  { 'AlreadyClaimed' : null } |
  { 'Success' : null } |
  {
    'CodeNotExpiredYet' : { 'time_until_resend_code_permitted' : Milliseconds }
  };
export interface SearchRequest {
  'max_results' : number,
  'search_term' : string,
};
export type SearchResponse = { 'Success' : { 'users' : Array<UserSummary> } };
export interface SetUsernameRequest { 'username' : string };
export type SetUsernameResponse = { 'SuccessNoChange' : null } |
  { 'UsernameTaken' : null } |
  { 'UsernameTooShort' : number } |
  { 'UsernameInvalid' : null } |
  { 'UsernameTooLong' : number } |
  { 'Success' : null } |
  { 'UserNotFound' : null };
export interface SubmitPhoneNumberRequest { 'number' : PhoneNumber };
export type SubmitPhoneNumberResponse = { 'AlreadyRegistered' : null } |
  { 'Success' : null } |
  { 'AlreadyRegisteredByOther' : null } |
  {
    'AlreadyRegisteredButUnclaimed' : {
      'time_until_resend_code_permitted' : [] | [Milliseconds],
    }
  } |
  { 'InvalidPhoneNumber' : null };
export type TimestampMillis = bigint;
export interface TransferCyclesRequest {
  'recipient' : UserId,
  'sender' : UserId,
  'amount' : bigint,
};
export type TransferCyclesResponse = { 'BalanceExceeded' : null } |
  { 'Success' : { 'new_balance' : bigint } } |
  { 'UserNotFound' : null } |
  { 'RecipientNotFound' : null };
export interface UpdateWasmRequest {
  'wasm' : Array<number>,
  'version' : string,
};
export type UpgradeCanisterRequest = {};
export type UserId = CanisterId;
export interface UserRequest {
  'username' : [] | [string],
  'user_id' : [] | [UserId],
};
export type UserResponse = { 'Success' : UserSummary } |
  { 'UserNotFound' : null };
export interface UserSummary {
  'username' : string,
  'last_online' : Milliseconds,
  'user_id' : UserId,
};
export interface UsersRequest {
  'users' : Array<UserId>,
  'updated_since' : [] | [TimestampMillis],
};
export type UsersResponse = {
    'Success' : { 'timestamp' : TimestampMillis, 'users' : Array<UserSummary> }
  };
export default interface _SERVICE {
  'confirm_phone_number' : (arg_0: ConfirmPhoneNumberRequest) => Promise<
      ConfirmPhoneNumberResponse
    >,
  'create_canister' : (arg_0: CreateCanisterRequest) => Promise<undefined>,
  'current_user' : (arg_0: CurrentUserRequest) => Promise<CurrentUserResponse>,
  'mark_as_online' : (arg_0: MarkAsOnlineRequest) => Promise<undefined>,
  'metrics' : (arg_0: MetricsRequest) => Promise<Metrics>,
  'notify_balance' : (arg_0: BalanceNotification) => Promise<undefined>,
  'resend_code' : (arg_0: ResendCodeRequest) => Promise<ResendCodeResponse>,
  'search' : (arg_0: SearchRequest) => Promise<SearchResponse>,
  'set_username' : (arg_0: SetUsernameRequest) => Promise<SetUsernameResponse>,
  'submit_phone_number' : (arg_0: SubmitPhoneNumberRequest) => Promise<
      SubmitPhoneNumberResponse
    >,
  'transfer_cycles' : (arg_0: TransferCyclesRequest) => Promise<
      TransferCyclesResponse
    >,
  'update_wasm' : (arg_0: UpdateWasmRequest) => Promise<undefined>,
  'upgrade_canister' : (arg_0: UpgradeCanisterRequest) => Promise<undefined>,
  'user' : (arg_0: UserRequest) => Promise<UserResponse>,
  'users' : (arg_0: UsersRequest) => Promise<UsersResponse>,
};
