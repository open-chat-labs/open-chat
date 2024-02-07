import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type Error = { 'CommonError' : null } |
  { 'InternalError' : string } |
  { 'UnsupportedToken' : string } |
  { 'InsufficientFunds' : null };
export type GetPoolsResponse = { 'ok' : Array<PoolData> } |
  { 'err' : Error };
export interface PoolData {
  'token0' : Token,
  'token1' : Token,
  'canisterId' : Principal,
}
export interface Token { 'address' : string, 'standard' : string }
export interface _SERVICE { 'getPools' : ActorMethod<[], GetPoolsResponse> }
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: ({ IDL }: { IDL: IDL }) => IDL.Type[];
