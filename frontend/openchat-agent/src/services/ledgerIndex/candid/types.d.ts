import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [SubAccount],
}
export interface Approve {
  'fee' : [] | [bigint],
  'from' : Account,
  'memo' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
  'expected_allowance' : [] | [bigint],
  'expires_at' : [] | [bigint],
  'spender' : Account,
}
export type Block = Value;
export type BlockIndex = bigint;
export interface Burn {
  'from' : Account,
  'memo' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
  'spender' : [] | [Account],
}
export interface FeeCollectorRanges {
  'ranges' : Array<[Account, Array<[BlockIndex, BlockIndex]>]>,
}
export interface GetAccountTransactionsArgs {
  /**
   * Maximum number of transactions to fetch.
   */
  'max_results' : bigint,
  /**
   * The txid of the last transaction seen by the client.
   * If None then the results will start from the most recent
   * txid.
   */
  'start' : [] | [BlockIndex],
  'account' : Account,
}
export interface GetBlocksRequest { 'start' : bigint, 'length' : bigint }
export interface GetBlocksResponse {
  'blocks' : Array<Block>,
  'chain_length' : bigint,
}
export interface GetTransactions {
  'balance' : Tokens,
  'transactions' : Array<TransactionWithId>,
  /**
   * The txid of the oldest transaction the account has
   */
  'oldest_tx_id' : [] | [BlockIndex],
}
export interface GetTransactionsErr { 'message' : string }
export type GetTransactionsResult = { 'Ok' : GetTransactions } |
  { 'Err' : GetTransactionsErr };
export type IndexArg = { 'Upgrade' : UpgradeArg } |
  { 'Init' : InitArg };
export interface InitArg {
  'ledger_id' : Principal,
  /**
   * The interval in seconds in which to retrieve blocks from the ledger. A lower value makes the index more
   * responsive in showing new blocks, but increases the consumption of cycles of both the index and ledger canisters.
   * A higher values means that it takes longer for new blocks to show up in the index.
   */
  'retrieve_blocks_from_ledger_interval_seconds' : [] | [bigint],
}
export interface ListSubaccountsArgs {
  'owner' : Principal,
  'start' : [] | [SubAccount],
}
export type Map = Array<[string, Value]>;
export interface Mint {
  'to' : Account,
  'memo' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
}
export interface Status { 'num_blocks_synced' : BlockIndex }
export type SubAccount = Uint8Array | number[];
export type Tokens = bigint;
export interface Transaction {
  'burn' : [] | [Burn],
  'kind' : string,
  'mint' : [] | [Mint],
  'approve' : [] | [Approve],
  'timestamp' : bigint,
  'transfer' : [] | [Transfer],
}
export interface TransactionWithId {
  'id' : BlockIndex,
  'transaction' : Transaction,
}
export interface Transfer {
  'to' : Account,
  'fee' : [] | [bigint],
  'from' : Account,
  'memo' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
  'spender' : [] | [Account],
}
export interface UpgradeArg {
  'ledger_id' : [] | [Principal],
  /**
   * The interval in seconds in which to retrieve blocks from the ledger. A lower value makes the index more
   * responsive in showing new blocks, but increases the consumption of cycles of both the index and ledger canisters.
   * A higher values means that it takes longer for new blocks to show up in the index.
   */
  'retrieve_blocks_from_ledger_interval_seconds' : [] | [bigint],
}
export type Value = { 'Int' : bigint } |
  { 'Map' : Map } |
  { 'Nat' : bigint } |
  { 'Nat64' : bigint } |
  { 'Blob' : Uint8Array | number[] } |
  { 'Text' : string } |
  { 'Array' : Array<Value> };
export interface _SERVICE {
  'get_account_transactions' : ActorMethod<
    [GetAccountTransactionsArgs],
    GetTransactionsResult
  >,
  'get_blocks' : ActorMethod<[GetBlocksRequest], GetBlocksResponse>,
  'get_fee_collectors_ranges' : ActorMethod<[], FeeCollectorRanges>,
  'icrc1_balance_of' : ActorMethod<[Account], Tokens>,
  'ledger_id' : ActorMethod<[], Principal>,
  'list_subaccounts' : ActorMethod<[ListSubaccountsArgs], Array<SubAccount>>,
  'status' : ActorMethod<[], Status>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
