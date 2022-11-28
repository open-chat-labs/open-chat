import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface AccountBalanceArgs { 'account' : AccountIdentifier }
export type AccountIdentifier = Uint8Array | number[];
export interface Tokens { 'e8s' : bigint }
export interface _SERVICE {
  'account_balance' : ActorMethod<[AccountBalanceArgs], Tokens>,
}
