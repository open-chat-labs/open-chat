import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface GetAccountIdentifierTransactionsError { 'message' : string }
export interface GetAccountIdentifierTransactionsResponse {
  'balance' : bigint,
  'transactions' : Array<TransactionWithId>,
  'oldest_tx_id' : [] | [bigint],
}
export type GetAccountIdentifierTransactionsResult = {
    'Ok' : GetAccountIdentifierTransactionsResponse
  } |
  { 'Err' : GetAccountIdentifierTransactionsError };
export interface GetAccountTransactionsArgs {
  'max_results' : bigint,
  'start' : [] | [bigint],
  'account' : Account,
}
export type Operation = {
    'Approve' : {
      'fee' : Tokens,
      'from' : string,
      'allowance' : Tokens,
      'expected_allowance' : [] | [Tokens],
      'expires_at' : [] | [TimeStamp],
      'spender' : string,
    }
  } |
  {
    'Burn' : { 'from' : string, 'amount' : Tokens, 'spender' : [] | [string] }
  } |
  { 'Mint' : { 'to' : string, 'amount' : Tokens } } |
  {
    'Transfer' : {
      'to' : string,
      'fee' : Tokens,
      'from' : string,
      'amount' : Tokens,
      'spender' : [] | [string],
    }
  };
export interface TimeStamp { 'timestamp_nanos' : bigint }
export interface Tokens { 'e8s' : bigint }
export interface Transaction {
  'memo' : bigint,
  'icrc1_memo' : [] | [Uint8Array | number[]],
  'operation' : Operation,
  'timestamp' : [] | [TimeStamp],
  'created_at_time' : [] | [TimeStamp],
}
export interface TransactionWithId {
  'id' : bigint,
  'transaction' : Transaction,
}
export interface _SERVICE {
  'get_account_transactions' : ActorMethod<
    [GetAccountTransactionsArgs],
    GetAccountIdentifierTransactionsResult
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
