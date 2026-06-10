import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface AMMPool {
  'token0' : string,
  'token1' : string,
  'reserve0' : bigint,
  'reserve1' : bigint,
  'price0' : number,
  'price1' : number,
  'totalLiquidity' : bigint,
}
export type GetAllAMMPoolsResponse = Array<AMMPool>;
export interface _SERVICE {
  'getAllAMMPools' : ActorMethod<[], GetAllAMMPoolsResponse>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
