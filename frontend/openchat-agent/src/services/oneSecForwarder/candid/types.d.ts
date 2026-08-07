import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface EnableForwardingArgs { 'icp_account' : IcpAccount }
export type IcpAccount = { 'ICRC' : IcrcAccount } |
  { 'AccountId' : string };
export interface IcrcAccount {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface IsForwardingAddressArgs { 'evm_address' : string }
export interface _SERVICE {
  'enable_forwarding' : ActorMethod<[EnableForwardingArgs], string>,
  'is_forwarding_address' : ActorMethod<[IsForwardingAddressArgs], boolean>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
