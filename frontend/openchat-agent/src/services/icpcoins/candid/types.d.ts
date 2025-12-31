import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface CoinWithDetails {
  'id' : PKKey,
  'decimals' : number,
  'deleted' : boolean,
  'name' : string,
  'rank' : number,
  'tags' : Array<string>,
  'ledger_id' : string,
  'details_json' : string,
  'details' : Array<[string, Value]>,
  'overview_json' : string,
  'symbol' : string,
  'unlisted' : boolean,
}
export interface Doc {
  'id' : PKKey,
  'decimals' : number,
  'deleted' : boolean,
  'name' : string,
  'rank' : number,
  'tags' : Array<string>,
  'ledger_id' : string,
  'details_json' : string,
  'overview_json' : string,
  'symbol' : string,
  'unlisted' : boolean,
}
export interface GetCoinFullReq {
  'id' : PKKey,
  'select' : [] | [Array<string>],
}
export type GetCoinFullResp = [Doc, Array<[string, Value]>];
export interface GetCoinsByMarketcapReq {
  'from' : [] | [bigint],
  'full' : boolean,
  'select' : [] | [Array<string>],
}
export interface GetCoinsByMarketcapResp {
  'last' : [] | [bigint],
  'coins' : Array<CoinWithDetails>,
}
export interface GetDetailsReq { 'id' : PKKey, 'select' : [] | [Array<string>] }
export type GetDetailsResp = Array<[string, Value]>;
export type PKKey = number;
export type SetDetailsReq = Array<
  { 'id' : PKKey, 'details' : Array<[string, Value]> }
>;
export interface SetReq {
  'id' : PKKey,
  'decimals' : number,
  'deleted' : boolean,
  'name' : string,
  'rank' : number,
  'tags' : Array<string>,
  'ledger_id' : string,
  'details_json' : string,
  'overview_json' : string,
  'symbol' : string,
  'unlisted' : boolean,
}
export type Value = number;
export interface _SERVICE {
  'get_coin_full' : ActorMethod<[GetCoinFullReq], GetCoinFullResp>,
  'get_coins_by_marketcap' : ActorMethod<
    [GetCoinsByMarketcapReq],
    GetCoinsByMarketcapResp
  >,
  'get_details' : ActorMethod<[GetDetailsReq], GetDetailsResp>,
  'set' : ActorMethod<[SetReq], undefined>,
  'set_details' : ActorMethod<[SetDetailsReq], undefined>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
