import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface HopDetail {
  'tokenIn' : string,
  'tokenOut' : string,
  'amountIn' : bigint,
  'amountOut' : bigint,
  'fee' : bigint,
  'priceImpact' : number,
}
export interface PotentialOrderDetails {
  'amount_init' : bigint,
  'amount_sell' : bigint,
}
export interface QuoteResponse {
  'expectedBuyAmount' : bigint,
  'fee' : bigint,
  'priceImpact' : number,
  'routeDescription' : string,
  'canFulfillFully' : boolean,
  'potentialOrderDetails' : [] | [PotentialOrderDetails],
  'hopDetails' : Array<HopDetail>,
}
export interface _SERVICE {
  'getExpectedReceiveAmount' : ActorMethod<[string, string, bigint], QuoteResponse>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
