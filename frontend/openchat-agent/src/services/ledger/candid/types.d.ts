import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface _SERVICE {
  'icrc1_balance_of' : ActorMethod<[Account], bigint>,
}
