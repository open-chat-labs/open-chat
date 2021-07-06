import type { Principal } from '@dfinity/agent';
export type BackendCanister = {
    'UserIndex' : null
  } |
  { 'PhoneIndex' : null } |
  { 'GroupIndex' : null } |
  { 'Group' : null } |
  { 'User' : null };
export type CanisterId = Principal;
export type IndexCanister = { 'UserIndex' : null } |
  { 'PhoneIndex' : null } |
  { 'GroupIndex' : null };
export interface InstallIndexArgs {
  'wasm' : Array<number>,
  'version' : string,
  'canister_type' : IndexCanister,
};
export type InstallIndexResponse = { 'Success' : CanisterId } |
  { 'Failure' : null };
export interface InstallWebsiteArgs {
  'wasm' : Array<number>,
  'version' : string,
  'canister_type' : IndexCanister,
};
export type InstallWebsiteResponse = { 'Success' : CanisterId } |
  { 'Failure' : null };
export type MetricsArgs = {};
export interface MetricsResponse {
  'cycles_balance' : bigint,
  'caller_id' : Principal,
  'bytes_used' : bigint,
  'timestamp' : bigint,
  'wasm_memory_used' : bigint,
};
export interface NotifyBalanceArgs { 'balance' : bigint };
export interface UpgradeArgs {
  'wasm' : Array<number>,
  'version' : string,
  'canister_type' : BackendCanister,
};
export type UpgradeResponse = { 'Success' : { 'canister_id' : CanisterId } } |
  { 'Failure' : null };
export default interface _SERVICE {
  'install_index' : (arg_0: InstallIndexArgs) => Promise<InstallIndexResponse>,
  'install_website' : (arg_0: InstallWebsiteArgs) => Promise<
      InstallWebsiteResponse
    >,
  'metrics' : (arg_0: MetricsArgs) => Promise<MetricsResponse>,
  'notify_balance' : (arg_0: NotifyBalanceArgs) => Promise<undefined>,
  'upgrade' : (arg_0: UpgradeArgs) => Promise<UpgradeResponse>,
};
