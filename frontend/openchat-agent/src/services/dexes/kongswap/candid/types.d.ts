import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface ICTokenReply {
  'fee' : bigint,
  'decimals' : number,
  'token' : string,
  'token_id' : number,
  'chain' : string,
  'name' : string,
  'canister_id' : string,
  'icrc1' : boolean,
  'icrc2' : boolean,
  'icrc3' : boolean,
  'pool_symbol' : string,
  'symbol' : string,
  'on_kong' : boolean,
}
export interface LPTokenReply {
  'fee' : bigint,
  'decimals' : number,
  'token' : string,
  'token_id' : number,
  'chain' : string,
  'name' : string,
  'address' : string,
  'pool_id_of' : number,
  'pool_symbol' : string,
  'total_supply' : bigint,
  'symbol' : string,
  'on_kong' : boolean,
}
export interface SwapAmountsReply {
  'txs' : Array<SwapAmountsTxReply>,
  'receive_chain' : string,
  'mid_price' : number,
  'pay_amount' : bigint,
  'receive_amount' : bigint,
  'pay_symbol' : string,
  'receive_symbol' : string,
  'price' : number,
  'pay_chain' : string,
  'slippage' : number,
}
export type SwapAmountsResult = { 'Ok' : SwapAmountsReply } |
  { 'Err' : string };
export interface SwapAmountsTxReply {
  'receive_chain' : string,
  'pay_amount' : bigint,
  'receive_amount' : bigint,
  'pay_symbol' : string,
  'receive_symbol' : string,
  'pool_symbol' : string,
  'price' : number,
  'pay_chain' : string,
  'lp_fee' : bigint,
  'gas_fee' : bigint,
}
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
