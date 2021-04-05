import type { Principal } from '@dfinity/agent';
export type ChatId = bigint;
export type GetCurrentUserResponse = { 'Success' : MyProfile } |
  { 'UserNotFound' : null };
export type GetUserIdResponse = { 'Success' : UserId } |
  { 'UserNotFound' : null };
export interface GetUsersRequest {
  'users' : Array<UserId>,
  'updated_since' : [] | [Timestamp],
};
export type GetUsersResponse = {
    'Success' : { 'timestamp' : Timestamp, 'users' : Array<UserSummary> }
  };
export interface MyProfile {
  'id' : UserId,
  'username' : string,
  'version' : number,
  'image_id' : [] | [string],
  'account_balance' : bigint,
};
export type RegisterUserResponse = { 'UsernameTaken' : null } |
  { 'Success' : MyProfile } |
  { 'UserExists' : null };
export interface SearchUsersRequest {
  'max_results' : number,
  'search_term' : string,
};
export type SearchUsersResponse = {
    'Success' : { 'users' : Array<UserSummary> }
  };
export type SetProfileImageResponse = { 'Success' : null } |
  { 'UserNotFound' : null };
export type Timestamp = bigint;
export interface TransferCyclesRequest {
  'recipient' : UserId,
  'sender' : UserId,
  'amount' : bigint,
};
export type TransferCyclesResponse = { 'BalanceExceeded' : null } |
  { 'Success' : { 'new_balance' : bigint } } |
  { 'UserNotFound' : null } |
  { 'RecipientNotFound' : null };
export type UpdateUsernameResponse = { 'SuccessNoChange' : null } |
  { 'UsernameTaken' : null } |
  { 'Success' : null } |
  { 'UserNotFound' : null };
export type UserId = Principal;
export interface UserSummary {
  'id' : UserId,
  'username' : string,
  'version' : number,
  'image_id' : [] | [string],
  'seconds_since_last_online' : number,
  'chat_id' : ChatId,
};
export default interface _SERVICE {
  'get_current_user' : () => Promise<GetCurrentUserResponse>,
  'get_user_id' : (arg_0: string) => Promise<GetUserIdResponse>,
  'get_users' : (arg_0: GetUsersRequest) => Promise<GetUsersResponse>,
  'mark_as_online' : () => Promise<undefined>,
  'register_user' : (arg_0: string) => Promise<RegisterUserResponse>,
  'search_users' : (arg_0: SearchUsersRequest) => Promise<SearchUsersResponse>,
  'set_profile_image' : (arg_0: string) => Promise<SetProfileImageResponse>,
  'transfer_cycles' : (arg_0: TransferCyclesRequest) => Promise<
      TransferCyclesResponse
    >,
  'update_username' : (arg_0: string) => Promise<UpdateUsernameResponse>,
};