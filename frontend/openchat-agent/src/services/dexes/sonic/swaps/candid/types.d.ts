import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface PairInfoExt {
  'id' : string,
  'price0CumulativeLast' : bigint,
  'creator' : Principal,
  'reserve0' : bigint,
  'reserve1' : bigint,
  'lptoken' : string,
  'totalSupply' : bigint,
  'token0' : string,
  'token1' : string,
  'price1CumulativeLast' : bigint,
  'kLast' : bigint,
  'blockTimestampLast' : bigint,
}
export interface _SERVICE {
  'getAllPairs' : ActorMethod<[], Array<PairInfoExt>>,
  'getPair' : ActorMethod<[Principal, Principal], [] | [PairInfoExt]>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
