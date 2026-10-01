import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface Allowance {
  'allowance' : bigint,
  'expires_at' : [] | [bigint],
}
export interface AllowanceArgs { 'account' : Account, 'spender' : Account }
export interface ApproveArgs {
  'fee' : [] | [bigint],
  'memo' : [] | [Uint8Array | number[]],
  'from_subaccount' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
  'expected_allowance' : [] | [bigint],
  'expires_at' : [] | [bigint],
  'spender' : Account,
}
export type ApproveError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'Duplicate' : { 'duplicate_of' : bigint } } |
  { 'BadFee' : { 'expected_fee' : bigint } } |
  { 'AllowanceChanged' : { 'current_allowance' : bigint } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'Expired' : { 'ledger_time' : bigint } } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export type ApproveResult = { 'Ok' : bigint } |
  { 'Err' : ApproveError };
export interface IcpTimeStamp { 'timestamp_nanos' : bigint }
export interface IcpTokens { 'e8s' : bigint }
export interface IcpTransferArgs {
  'to' : Uint8Array | number[],
  'fee' : IcpTokens,
  'memo' : bigint,
  'from_subaccount' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [IcpTimeStamp],
  'amount' : IcpTokens,
}
export type IcpTransferError = {
    'TxTooOld' : { 'allowed_window_nanos' : bigint }
  } |
  { 'BadFee' : { 'expected_fee' : IcpTokens } } |
  { 'TxDuplicate' : { 'duplicate_of' : bigint } } |
  { 'TxCreatedInFuture' : null } |
  { 'InsufficientFunds' : { 'balance' : IcpTokens } };
export type IcpTransferResult = { 'Ok' : bigint } |
  { 'Err' : IcpTransferError };
export interface TransferArg {
  'to' : Account,
  'fee' : [] | [bigint],
  'memo' : [] | [Uint8Array | number[]],
  'from_subaccount' : [] | [Uint8Array | number[]],
  'created_at_time' : [] | [bigint],
  'amount' : bigint,
}
export type TransferError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'BadBurn' : { 'min_burn_amount' : bigint } } |
  { 'Duplicate' : { 'duplicate_of' : bigint } } |
  { 'BadFee' : { 'expected_fee' : bigint } } |
  { 'CreatedInFuture' : { 'ledger_time' : bigint } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export type TransferResult = { 'Ok' : bigint } |
  { 'Err' : TransferError };
export interface _SERVICE {
  'icrc1_balance_of' : ActorMethod<[Account], bigint>,
  'icrc1_transfer' : ActorMethod<[TransferArg], TransferResult>,
  'icrc2_allowance' : ActorMethod<[AllowanceArgs], Allowance>,
  'icrc2_approve' : ActorMethod<[ApproveArgs], ApproveResult>,
  'transfer' : ActorMethod<[IcpTransferArgs], IcpTransferResult>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
