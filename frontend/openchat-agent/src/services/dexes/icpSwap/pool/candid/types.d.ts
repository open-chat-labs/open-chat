import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface DepositAndSwapArgs {
  'tokenInFee' : bigint,
  'amountIn' : string,
  'zeroForOne' : boolean,
  'amountOutMinimum' : string,
  'tokenOutFee' : bigint,
}
export type Error = { 'CommonError' : null } |
  { 'InternalError' : string } |
  { 'UnsupportedToken' : string } |
  { 'InsufficientFunds' : null };
export type NatResult = { 'ok' : bigint } |
  { 'err' : Error };
export interface SwapArgs {
  'amountIn' : string,
  'zeroForOne' : boolean,
  'amountOutMinimum' : string,
}
export interface _SERVICE {
  'depositFromAndSwap' : ActorMethod<[DepositAndSwapArgs], NatResult>,
  'quoteForAll' : ActorMethod<[SwapArgs], NatResult>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
