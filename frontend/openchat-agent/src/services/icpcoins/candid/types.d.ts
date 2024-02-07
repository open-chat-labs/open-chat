import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type LatestTokenRow = [[TokenId, TokenId], string, number];
export type TokenId = bigint;
export interface _SERVICE {
  'get_latest' : ActorMethod<[], Array<LatestTokenRow>>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: ({ IDL }: { IDL: IDL }) => IDL.Type[];
