import type { Principal } from "@dfinity/principal";
export interface BalanceNotification {
  balance: bigint;
}
export type CanisterId = Principal;
export interface CreateUserRequest {
  user_principal: Principal;
  phone_number: PhoneNumber;
}
export type CreateUserResponse =
  | { UserLimitReached: bigint }
  | { Success: { canister: CanisterId } }
  | { UserExists: null };
export interface GetCurrentUserRequest {
  username: [] | [string];
  user_id: [] | [UserId];
}
export type GetCurrentUserResponse =
  | {
      Success: {
        id: UserId;
        username: string;
        version: number;
        account_balance: bigint;
      };
    }
  | { UserNotFound: null };
export interface GetUserRequest {
  username: [] | [string];
  user_id: [] | [UserId];
}
export type GetUserResponse = { Success: UserSummary } | { UserNotFound: null };
export interface GetUsersRequest {
  users: Array<UserId>;
  updated_since: [] | [Timestamp];
}
export type GetUsersResponse = {
  Success: { timestamp: Timestamp; users: Array<UserSummary> };
};
export type MarkAsOnlineRequest = {};
export interface Metrics {
  user_count: bigint;
  cycles_balance: bigint;
  caller_id: Principal;
  bytes_used: bigint;
  timestamp: bigint;
  online_user_count: bigint;
  wasm_memory_used: bigint;
  cycles_transferred: bigint;
  active_user_count: bigint;
}
export interface PhoneNumber {
  country_code: number;
  number: bigint;
}
export interface SearchUsersRequest {
  max_results: number;
  search_term: string;
}
export type SearchUsersResponse = {
  Success: { users: Array<UserSummary> };
};
export type Timestamp = bigint;
export interface TransferCyclesRequest {
  recipient: UserId;
  sender: UserId;
  amount: bigint;
}
export type TransferCyclesResponse =
  | { BalanceExceeded: null }
  | { Success: { new_balance: bigint } }
  | { UserNotFound: null }
  | { RecipientNotFound: null };
export interface UpdateUsernameRequest {
  username: string;
}
export type UpdateUsernameResponse =
  | { SuccessNoChange: null }
  | { UsernameTaken: null }
  | { UsernameTooShort: number }
  | { UsernameTooLong: number }
  | { Success: null }
  | { UserNotFound: null };
export interface UpgradeRequest {
  wasm: Array<number>;
  version: string;
}
export type UpgradeResponse =
  | { Success: { canister_id: CanisterId } }
  | { Failure: null };
export type UserId = CanisterId;
export interface UserSummary {
  id: UserId;
  username: string;
  version: number;
  seconds_since_last_online: number;
}
export default interface _SERVICE {
  create: (arg_0: CreateUserRequest) => Promise<CreateUserResponse>;
  get_current_user: (
    arg_0: GetCurrentUserRequest
  ) => Promise<GetCurrentUserResponse>;
  get_user: (arg_0: GetUserRequest) => Promise<GetUserResponse>;
  get_users: (arg_0: GetUsersRequest) => Promise<GetUsersResponse>;
  mark_as_online: (arg_0: MarkAsOnlineRequest) => Promise<undefined>;
  metrics: () => Promise<Metrics>;
  notify_balance: (arg_0: BalanceNotification) => Promise<undefined>;
  search_users: (arg_0: SearchUsersRequest) => Promise<SearchUsersResponse>;
  transfer_cycles: (
    arg_0: TransferCyclesRequest
  ) => Promise<TransferCyclesResponse>;
  update_username: (
    arg_0: UpdateUsernameRequest
  ) => Promise<UpdateUsernameResponse>;
  upgrade: (arg_0: UpgradeRequest) => Promise<UpgradeResponse>;
}
