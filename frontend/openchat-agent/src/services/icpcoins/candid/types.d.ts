import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

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
export interface GetCoinsByMarketcapReq {
  'from' : [] | [bigint],
  'full' : boolean,
  'select' : [] | [Array<string>],
}
export interface GetCoinsByMarketcapResp {
  'last' : [] | [bigint],
  'coins' : Array<CoinWithDetails>,
}
export type PKKey = number;
export type Value = number;
export interface _SERVICE {
  'get_coins_by_marketcap' : ActorMethod<
    [GetCoinsByMarketcapReq],
    GetCoinsByMarketcapResp
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
