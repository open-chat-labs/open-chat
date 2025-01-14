import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface PublicTokenOverview {
  'volumeUSD7d' : number,
  'address' : string,
  'priceUSD' : number,
  'symbol' : string,
}
export interface _SERVICE {
  'getAllTokens' : ActorMethod<[], Array<PublicTokenOverview>>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
