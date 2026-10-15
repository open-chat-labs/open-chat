import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

/**
 * Smallest denomination of SOL, the native token on Solana,
 * i.e. 1_000_000_000 Lamports is 1 SOL
 */
export type Lamport = bigint;
/**
 * Information about the ckSOL minter canister.
 */
export interface MinterInfo { 'minimum_deposit_amount' : Lamport }
export interface _SERVICE {
  /**
   * Returns information about the ckSOL minter canister.
   */
  'get_minter_info' : ActorMethod<[], MinterInfo>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
