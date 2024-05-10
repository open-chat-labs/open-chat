import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type Address = string;
export type CanisterPublicKey = PublicKey;
export interface Delegation {
  'pubkey' : PublicKey,
  'targets' : [] | [Array<Principal>],
  'expiration' : Timestamp,
}
export type GetAddressResponse = { 'Ok' : Address } |
  { 'Err' : string };
export type GetDelegationResponse = { 'Ok' : SignedDelegation } |
  { 'Err' : string };
export type GetPrincipalResponse = { 'Ok' : Principal } |
  { 'Err' : string };
export interface LoginDetails {
  'user_canister_pubkey' : CanisterPublicKey,
  'expiration' : Timestamp,
}
export type LoginResponse = { 'Ok' : LoginDetails } |
  { 'Err' : string };
export type PrepareLoginResponse = { 'Ok' : SiwsMessage } |
  { 'Err' : string };
export type Principal = Uint8Array | number[];
export type PublicKey = Uint8Array | number[];
export type RuntimeFeature = { 'IncludeUriInSeed' : null } |
  { 'DisablePrincipalToSolMapping' : null } |
  { 'DisableSolToPrincipalMapping' : null };
export type SessionKey = PublicKey;
export interface SettingsInput {
  'uri' : string,
  'runtime_features' : [] | [Array<RuntimeFeature>],
  'domain' : string,
  'statement' : [] | [string],
  'scheme' : [] | [string],
  'salt' : string,
  'session_expires_in' : [] | [bigint],
  'targets' : [] | [Array<string>],
  'chain_id' : [] | [string],
  'sign_in_expires_in' : [] | [bigint],
}
export interface SignedDelegation {
  'signature' : Uint8Array | number[],
  'delegation' : Delegation,
}
export interface SiwsMessage {
  'uri' : string,
  'issued_at' : bigint,
  'domain' : string,
  'statement' : string,
  'version' : number,
  'chain_id' : string,
  'address' : Address,
  'nonce' : string,
  'expiration_time' : bigint,
}
export type SiwsSignature = string;
export type Timestamp = bigint;
export interface _SERVICE {
  'get_address' : ActorMethod<[Principal], GetAddressResponse>,
  'get_caller_address' : ActorMethod<[], GetAddressResponse>,
  'get_principal' : ActorMethod<[Address], GetPrincipalResponse>,
  'siws_get_delegation' : ActorMethod<
    [Address, SessionKey, Timestamp],
    GetDelegationResponse
  >,
  'siws_login' : ActorMethod<
    [SiwsSignature, Address, SessionKey],
    LoginResponse
  >,
  'siws_prepare_login' : ActorMethod<[Address], PrepareLoginResponse>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
