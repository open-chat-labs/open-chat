import type { Principal } from "@dfinity/principal";
export type BackendCanister =
  | { UserIndex: null }
  | { PhoneIndex: null }
  | { GroupIndex: null }
  | { Group: null }
  | { User: null };
export interface BalanceNotification {
  balance: bigint;
}
export type CanisterId = Principal;
export type IndexCanister =
  | { UserIndex: null }
  | { PhoneIndex: null }
  | { GroupIndex: null };
export interface InstallIndexRequest {
  wasm: Array<number>;
  version: string;
  canister_type: IndexCanister;
}
export type InstallIndexResponse = { Success: CanisterId } | { Failure: null };
export interface InstallWebsiteRequest {
  wasm: Array<number>;
  version: string;
  canister_type: IndexCanister;
}
export type InstallWebsiteResponse =
  | { Success: CanisterId }
  | { Failure: null };
export interface Metrics {
  cycles_balance: bigint;
  caller_id: Principal;
  bytes_used: bigint;
  timestamp: bigint;
  wasm_memory_used: bigint;
}
export interface UpgradeRequest {
  wasm: Array<number>;
  version: string;
  canister_type: BackendCanister;
}
export type UpgradeResponse =
  | { Success: { canister_id: CanisterId } }
  | { Failure: null };
export default interface _SERVICE {
  install_index: (arg_0: InstallIndexRequest) => Promise<InstallIndexResponse>;
  install_website: (
    arg_0: InstallWebsiteRequest
  ) => Promise<InstallWebsiteResponse>;
  metrics: () => Promise<Metrics>;
  notify_balance: (arg_0: BalanceNotification) => Promise<undefined>;
  upgrade: (arg_0: UpgradeRequest) => Promise<UpgradeResponse>;
}
