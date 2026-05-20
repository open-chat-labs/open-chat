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
export interface QuoteRoute {
  'expectedBuyAmount' : bigint,
  'fee' : bigint,
  'priceImpact' : number,
  'routeDescription' : string,
  'canFulfillFully' : boolean,
  'potentialOrderDetails' : [] | [PotentialOrderDetails],
  'hopDetails' : Array<HopDetail>,
  'routeTokens' : Array<string>,
  'tradingFeeBps' : bigint,
}
export interface RequestResponse {
  'routes' : Array<QuoteRoute>,
}
export interface Request {
  'tokenSell' : string,
  'tokenBuy' : string,
  'amountSell' : bigint,
}
export type BatchMultiResponse = Array<RequestResponse>;
export interface _SERVICE {
  'getExpectedReceiveAmountBatchMulti' : ActorMethod<
    [Array<Request>, bigint],
    BatchMultiResponse
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
