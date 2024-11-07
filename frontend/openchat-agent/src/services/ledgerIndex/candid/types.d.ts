import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

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
  'max_results' : bigint,
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
  'oldest_tx_id' : [] | [BlockIndex],
}
export interface GetTransactionsErr { 'message' : string }
export type GetTransactionsResult = { 'Ok' : GetTransactions } |
  { 'Err' : GetTransactionsErr };
export type IndexArg = { 'Upgrade' : UpgradeArg } |
  { 'Init' : InitArg };
export interface InitArg {
  'ledger_id' : Principal,
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
