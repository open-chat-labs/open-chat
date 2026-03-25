import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

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
  /**
   * Maximum number of transactions to fetch.
   */
  'max_results' : bigint,
  /**
   * The txid of the last transaction seen by the client.
   * If None then the results will start from the most recent
   * txid. If set then the results will start from the next
   * most recent txid after start (start won't be included).
   */
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
