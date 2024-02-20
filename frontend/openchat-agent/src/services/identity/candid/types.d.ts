import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type CheckAuthPrincipalResponse = { 'NotFound' : null } |
  { 'Success' : null } |
  { 'Legacy' : null };
export interface GetDelegationArgs {
  'session_key' : PublicKey,
  'expiration' : TimestampNanoseconds,
}
export type GetDelegationResponse = { 'NotFound' : null } |
  { 'Success' : SignedDelegation };
export type MigrateLegacyPrincipalResponse = { 'NotFound' : null } |
  { 'Success' : { 'new_principal' : Principal } } |
  { 'InternalError' : string } |
  { 'AlreadyMigrated' : null };
export type Nanoseconds = bigint;
export interface PrepareDelegationArgs {
  'session_key' : PublicKey,
  'max_time_to_live' : [] | [Nanoseconds],
}
export type PrepareDelegationResponse = { 'NotFound' : null } |
  {
    'Success' : { 'user_key' : PublicKey, 'expiration' : TimestampNanoseconds }
  };
export type PublicKey = Uint8Array | number[];
export interface SignedDelegation {
  'signature' : Uint8Array | number[],
  'delegation' : { 'pubkey' : PublicKey, 'expiration' : TimestampNanoseconds },
}
export type TimestampNanoseconds = bigint;
export interface _SERVICE {
  'check_auth_principal' : ActorMethod<[{}], CheckAuthPrincipalResponse>,
  'get_delegation' : ActorMethod<[GetDelegationArgs], GetDelegationResponse>,
  'migrate_legacy_principal' : ActorMethod<
    [{}],
    MigrateLegacyPrincipalResponse
  >,
  'prepare_delegation' : ActorMethod<
    [PrepareDelegationArgs],
    PrepareDelegationResponse
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: ({ IDL }: { IDL: IDL }) => IDL.Type[];
