import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface Delegation {
  'pubkey' : Uint8Array | number[],
  'expiration' : bigint,
}
export interface GenerateMagicLinkArgs {
  'session_key' : Uint8Array | number[],
  'email' : string,
  'max_time_to_live' : [] | [bigint],
}
export type GenerateMagicLinkResponse = { 'Blocked' : bigint } |
  { 'EmailInvalid' : null } |
  { 'FailedToSendEmail' : string } |
  { 'Success' : GenerateMagicLinkSuccess };
export interface GenerateMagicLinkSuccess {
  'created' : bigint,
  'user_key' : Uint8Array | number[],
  'expiration' : bigint,
}
export interface GetDelegationArgs {
  'session_key' : Uint8Array | number[],
  'email' : string,
  'expiration' : bigint,
}
export type GetDelegationResponse = { 'NotFound' : null } |
  { 'Success' : SignedDelegation };
export interface HandleMagicLinkArgs { 'link' : string }
export type HandleMagicLinkResponse = { 'Success' : null } |
  { 'LinkExpired' : null } |
  { 'LinkInvalid' : string };
export interface SignedDelegation {
  'signature' : Uint8Array | number[],
  'delegation' : Delegation,
}
export interface _SERVICE {
  'generate_magic_link' : ActorMethod<
    [GenerateMagicLinkArgs],
    GenerateMagicLinkResponse
  >,
  'get_delegation' : ActorMethod<[GetDelegationArgs], GetDelegationResponse>,
  'handle_magic_link' : ActorMethod<
    [HandleMagicLinkArgs],
    HandleMagicLinkResponse
  >,
}
