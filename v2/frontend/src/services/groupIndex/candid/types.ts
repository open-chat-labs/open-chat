import type { Principal } from '@dfinity/principal';
export type CanisterId = Principal;
export interface CreateArgs { 'is_public' : boolean, 'name' : string }
export type CreateResponse = { 'PublicGroupAlreadyExists' : null } |
  { 'UnknownError' : null } |
  { 'Success' : { 'canister_id' : CanisterId } } |
  { 'InvalidName' : null } |
  { 'NameTooLong' : number } |
  { 'GroupLimitExceeded' : null };
export interface DeleteArgs { 'group_id' : GroupId }
export type DeleteResponse = { 'NotFound' : null } |
  { 'Success' : null } |
  { 'NotAdmin' : null };
export type GroupId = CanisterId;
export type MetricsArgs = {};
export interface MetricsResponse {
  'cycles_balance' : bigint,
  'private_group_count' : bigint,
  'active_public_group_count' : bigint,
  'active_private_group_count' : bigint,
  'caller_id' : Principal,
  'deleted_public_group_count' : bigint,
  'bytes_used' : bigint,
  'timestamp' : TimestampMillis,
  'deleted_private_group_count' : bigint,
  'public_group_count' : bigint,
  'wasm_memory_used' : bigint,
}
export interface NotifyBalanceArgs { 'balance' : bigint }
export interface SearchArgs { 'max_results' : number, 'search_term' : string }
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
export type TimestampMillis = bigint;
export interface UpgradeArgs { 'wasm' : Array<number>, 'version' : string }
export type UpgradeResponse = { 'Success' : { 'canister_id' : CanisterId } } |
  { 'Failure' : null };
export interface _SERVICE {
  'create' : (arg_0: CreateArgs) => Promise<CreateResponse>,
  'delete' : (arg_0: DeleteArgs) => Promise<DeleteResponse>,
  'metrics' : (arg_0: MetricsArgs) => Promise<MetricsResponse>,
  'notify_balance' : (arg_0: NotifyBalanceArgs) => Promise<undefined>,
  'search' : (arg_0: SearchArgs) => Promise<SearchResponse>,
  'upgrade' : (arg_0: UpgradeArgs) => Promise<UpgradeResponse>,
}
