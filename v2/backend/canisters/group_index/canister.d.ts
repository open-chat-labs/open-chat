import type { Principal } from '@dfinity/principal';
export interface BalanceNotification { 'balance' : bigint };
export type CanisterId = Principal;
export interface CreateRequest { 'is_public' : boolean, 'name' : string };
export type CreateResponse = { 'PublicGroupAlreadyExists' : null } |
  { 'UnknownError' : null } |
  { 'Success' : { 'canister_id' : CanisterId } } |
  { 'InvalidName' : null } |
  { 'NameTooLong' : number } |
  { 'GroupLimitExceeded' : null };
export interface DeleteRequest { 'group_id' : GroupId };
export type DeleteResponse = { 'NotFound' : null } |
  { 'Success' : null } |
  { 'NotAdmin' : null };
export type GroupId = CanisterId;
export interface Metrics {
  'cycles_balance' : bigint,
  'private_group_count' : bigint,
  'active_public_group_count' : bigint,
  'active_private_group_count' : bigint,
  'caller_id' : Principal,
  'deleted_public_group_count' : bigint,
  'bytes_used' : bigint,
  'timestamp' : bigint,
  'deleted_private_group_count' : bigint,
  'public_group_count' : bigint,
  'wasm_memory_used' : bigint,
};
export interface SearchRequest {
  'max_results' : number,
  'search_term' : string,
};
export type SearchResponse = { 'TermTooShort' : number } |
  {
    'Success' : {
      'groups' : Array<
        { 'name' : string, 'score' : number, 'group_id' : GroupId }
      >,
    }
  } |
  { 'TermTooLong' : number } |
  { 'InvalidTerm' : null };
export type Timestamp = bigint;
export interface UpgradeRequest { 'wasm' : Array<number>, 'version' : string };
export type UpgradeResponse = { 'Success' : { 'canister_id' : CanisterId } } |
  { 'Failure' : null };
export default interface _SERVICE {
  'create' : (arg_0: CreateRequest) => Promise<CreateResponse>,
  'delete' : (arg_0: DeleteRequest) => Promise<DeleteResponse>,
  'metrics' : () => Promise<Metrics>,
  'notify_balance' : (arg_0: BalanceNotification) => Promise<undefined>,
  'search' : (arg_0: SearchRequest) => Promise<SearchResponse>,
  'upgrade' : (arg_0: UpgradeRequest) => Promise<UpgradeResponse>,
};
