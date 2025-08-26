import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface ICTokenReply { 'canister_id' : string, 'is_removed' : boolean }
export type LPTokenReply = {};
export interface SwapAmountsReply { 'receive_amount' : bigint }
export type SwapAmountsResult = { 'Ok' : SwapAmountsReply } |
  { 'Err' : string };
export type TokenReply = { 'IC' : ICTokenReply } |
  { 'LP' : LPTokenReply };
export type TokensResult = { 'Ok' : Array<TokenReply> } |
  { 'Err' : string };
export interface _SERVICE {
  'swap_amounts' : ActorMethod<[string, bigint, string], SwapAmountsResult>,
  'tokens' : ActorMethod<[[] | [string]], TokensResult>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
