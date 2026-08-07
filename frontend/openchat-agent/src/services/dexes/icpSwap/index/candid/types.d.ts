import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

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
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
