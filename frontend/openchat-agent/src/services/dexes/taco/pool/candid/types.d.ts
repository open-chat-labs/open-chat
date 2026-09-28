import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export type ExchangeError = { 'InvalidInput' : string } |
  { 'PoolNotFound' : string } |
  { 'SystemError' : string } |
  { 'OrderNotFound' : string } |
  { 'TokenPaused' : string } |
  { 'NotAuthorized' : null } |
  { 'RouteFailed' : { 'hop' : bigint, 'reason' : string } } |
  { 'Banned' : null } |
  { 'ExchangeFrozen' : null } |
  { 'TransferFailed' : string } |
  { 'SlippageExceeded' : { 'got' : bigint, 'expected' : bigint } } |
  { 'TokenNotAccepted' : string } |
  { 'InsufficientFunds' : string };
export interface OptimalSwapLeg {
  'bp' : bigint,
  'routeDescription' : string,
  'route' : Array<SwapHop>,
  'expectedBuyAmount' : bigint,
}
export interface OptimalSwapPlan {
  'fee' : bigint,
  'tradingFeeBps' : bigint,
  'routeDescription' : string,
  'canFulfillFully' : boolean,
  'legs' : Array<OptimalSwapLeg>,
  'priceImpact' : number,
  'expectedBuyAmount' : bigint,
}
export interface SplitLeg {
  'amountIn' : bigint,
  'route' : Array<SwapHop>,
  'minLegOut' : bigint,
}
export interface SwapHop { 'tokenIn' : string, 'tokenOut' : string }
export interface SwapOk {
  'fee' : bigint,
  'tokenIn' : string,
  'tokenOut' : string,
  'hops' : bigint,
  'firstHopOrderbookMatch' : boolean,
  'amountIn' : bigint,
  'amountOut' : bigint,
  'swapId' : bigint,
  'route' : Array<string>,
  'lastHopAMMOnly' : boolean,
}
export type SwapResult = { 'Ok' : SwapOk } |
  { 'Err' : ExchangeError };
export interface _SERVICE {
  'getExpectedReceiveAmountBatchMultiOptimal' : ActorMethod<
    [string, string, bigint],
    OptimalSwapPlan
  >,
  'getV2AllowedTokens' : ActorMethod<[], Array<string>>,
  'getV2Enabled' : ActorMethod<[], boolean>,
  'netToGrossV2' : ActorMethod<[string, bigint], bigint>,
  'requiredAllowanceV2' : ActorMethod<[string, bigint], bigint>,
  'swapMultiHopV2' : ActorMethod<
    [string, string, bigint, Array<SwapHop>, bigint],
    SwapResult
  >,
  'swapSplitRoutesV2' : ActorMethod<
    [string, string, Array<SplitLeg>, bigint],
    SwapResult
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
