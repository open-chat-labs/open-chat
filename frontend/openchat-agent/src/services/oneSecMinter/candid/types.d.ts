import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type Account = { 'Evm' : EvmAccount } |
  { 'Icp' : IcpAccount };
export interface AssetInfo {
  'tx' : [] | [Tx],
  'token' : [] | [Token],
  'chain' : [] | [Chain],
  'account' : [] | [Account],
  'amount' : bigint,
}
export type Chain = { 'ICP' : null } |
  { 'Base' : null } |
  { 'Ethereum' : null } |
  { 'Arbitrum' : null };
export interface ErrorMessage { 'error' : string }
export interface EvmAccount { 'address' : string }
export type EvmChain = { 'Base' : null } |
  { 'Ethereum' : null } |
  { 'Arbitrum' : null };
export interface EvmTx { 'log_index' : [] | [bigint], 'hash' : string }
export interface ForwardEvmToIcpArg {
  'token' : Token,
  'chain' : EvmChain,
  'address' : string,
  'receiver' : IcpAccount,
}
export interface ForwardingResponse {
  'status' : [] | [ForwardingStatus],
  'done' : [] | [TransferId],
}
export type ForwardingStatus = {
    'LowBalance' : { 'balance' : bigint, 'min_amount' : bigint }
  } |
  { 'CheckingBalance' : null } |
  { 'Forwarding' : null } |
  { 'Forwarded' : EvmTx };
export type IcpAccount = {
    'ICRC' : {
      'owner' : Principal,
      'subaccount' : [] | [Uint8Array | number[]],
    }
  } |
  { 'AccountId' : string };
export interface IcpTx { 'block_index' : bigint, 'ledger' : Principal }
export type Result = { 'Ok' : null } |
  { 'Err' : string };
export type Status = { 'Failed' : ErrorMessage } |
  { 'Refunded' : Tx } |
  { 'PendingRefundTx' : null } |
  { 'PendingDestinationTx' : null } |
  { 'Succeeded' : null } |
  { 'PendingSourceTx' : null };
export type Token = { 'BOB' : null } |
  { 'ICP' : null } |
  { 'GLDT' : null } |
  { 'USDC' : null } |
  { 'USDT' : null } |
  { 'cbBTC' : null } |
  { 'ckBTC' : null };
export interface Trace { 'entries' : Array<TraceEntry> }
export interface TraceEntry {
  'tx' : [] | [Tx],
  'end' : [] | [bigint],
  'result' : [] | [Result],
  'chain' : [] | [Chain],
  'block_number' : [] | [bigint],
  'event' : [] | [TraceEvent],
  'start' : bigint,
}
export type TraceEvent = { 'PendingConfirmTx' : null } |
  { 'ConfirmTx' : null } |
  { 'SendTx' : null } |
  { 'FetchTx' : null } |
  { 'SignTx' : null };
export interface Transfer {
  'end' : [] | [bigint],
  'status' : [] | [Status],
  'destination' : AssetInfo,
  'trace' : Trace,
  'source' : AssetInfo,
  'start' : [] | [bigint],
  'queue_position' : [] | [bigint],
}
export interface TransferFee {
  'source_chain' : [] | [Chain],
  'destination_chain' : [] | [Chain],
  'latest_transfer_fee_in_tokens' : bigint,
  'min_amount' : bigint,
  'average_transfer_fee_in_tokens' : bigint,
  'available' : [] | [bigint],
  'source_token' : [] | [Token],
  'max_amount' : bigint,
  'protocol_fee_in_percent' : number,
  'destination_token' : [] | [Token],
}
export interface TransferId { 'id' : bigint }
export type Tx = { 'Evm' : EvmTx } |
  { 'Icp' : IcpTx };
export interface _SERVICE {
  'forward_evm_to_icp' : ActorMethod<
    [ForwardEvmToIcpArg],
    { 'Ok' : ForwardingResponse } |
      { 'Err' : string }
  >,
  'get_forwarding_address' : ActorMethod<
    [IcpAccount],
    { 'Ok' : string } |
      { 'Err' : string }
  >,
  'get_forwarding_status' : ActorMethod<
    [ForwardEvmToIcpArg],
    { 'Ok' : ForwardingResponse } |
      { 'Err' : string }
  >,
  'get_transfer' : ActorMethod<
    [TransferId],
    { 'Ok' : Transfer } |
      { 'Err' : string }
  >,
  'get_transfer_fees' : ActorMethod<[], Array<TransferFee>>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
