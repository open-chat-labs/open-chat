import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface SwapHop {
  'tokenIn' : string,
  'tokenOut' : string,
}
export interface OptimalSwapLeg {
  'bp' : bigint,
  'expectedBuyAmount' : bigint,
  'route' : Array<SwapHop>,
  'routeDescription' : string,
}
export interface OptimalSwapPlan {
  'expectedBuyAmount' : bigint,
  'fee' : bigint,
  'priceImpact' : number,
  'canFulfillFully' : boolean,
  'tradingFeeBps' : bigint,
  'routeDescription' : string,
  'legs' : Array<OptimalSwapLeg>,
}
export interface _SERVICE {
  'getExpectedReceiveAmountBatchMultiOptimal' : ActorMethod<
    [string, string, bigint],
    OptimalSwapPlan
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
