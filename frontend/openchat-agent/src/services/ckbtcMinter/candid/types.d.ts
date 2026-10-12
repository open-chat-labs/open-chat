import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface MinterInfo {
  'retrieve_btc_min_amount' : bigint,
  'min_confirmations' : number,
  'kyt_fee' : bigint,
}
export interface RetrieveBtcOk { 'block_index' : bigint }
export interface RetrieveBtcWithApprovalArgs {
  'from_subaccount' : [] | [Uint8Array | number[]],
  'address' : string,
  'amount' : bigint,
}
export type RetrieveBtcWithApprovalError = { 'MalformedAddress' : string } |
  { 'GenericError' : { 'error_message' : string, 'error_code' : bigint } } |
  { 'TemporarilyUnavailable' : string } |
  { 'InsufficientAllowance' : { 'allowance' : bigint } } |
  { 'AlreadyProcessing' : null } |
  { 'AmountTooLow' : bigint } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export interface Utxo {
  'height' : number,
  'value' : bigint,
  'outpoint' : { 'txid' : Uint8Array | number[], 'vout' : number },
}
export interface _SERVICE {
  'estimate_withdrawal_fee' : ActorMethod<
    [{ 'amount' : [] | [bigint] }],
    { 'minter_fee' : bigint, 'bitcoin_fee' : bigint }
  >,
  'get_deposit_fee' : ActorMethod<[], bigint>,
  'get_known_utxos' : ActorMethod<
    [
      {
        'owner' : [] | [Principal],
        'subaccount' : [] | [Uint8Array | number[]],
      },
    ],
    Array<Utxo>
  >,
  'get_minter_info' : ActorMethod<[], MinterInfo>,
  'retrieve_btc_with_approval' : ActorMethod<
    [RetrieveBtcWithApprovalArgs],
    { 'Ok' : RetrieveBtcOk } |
      { 'Err' : RetrieveBtcWithApprovalError }
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
