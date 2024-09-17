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
export type Nonce = string;
export interface PrepareLoginOkResponse {
  'nonce' : string,
  'siwe_message' : SiweMessage,
}
export type PrepareLoginResponse = { 'Ok' : PrepareLoginOkResponse } |
  { 'Err' : string };
export type Principal = Uint8Array | number[];
export type PublicKey = Uint8Array | number[];
export type RuntimeFeature = { 'IncludeUriInSeed' : null } |
  { 'DisableEthToPrincipalMapping' : null } |
  { 'DisablePrincipalToEthMapping' : null };
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
  'chain_id' : [] | [bigint],
  'sign_in_expires_in' : [] | [bigint],
}
export interface SignedDelegation {
  'signature' : Uint8Array | number[],
  'delegation' : Delegation,
}
export type SiweMessage = string;
export type SiweSignature = string;
export type Timestamp = bigint;
export interface _SERVICE {
  'get_address' : ActorMethod<[Principal], GetAddressResponse>,
  'get_caller_address' : ActorMethod<[], GetAddressResponse>,
  'get_principal' : ActorMethod<[Address], GetPrincipalResponse>,
  'siwe_get_delegation' : ActorMethod<
    [Address, SessionKey, Timestamp],
    GetDelegationResponse
  >,
  'siwe_login' : ActorMethod<
    [SiweSignature, Address, SessionKey, Nonce],
    LoginResponse
  >,
  'siwe_prepare_login' : ActorMethod<[Address], PrepareLoginResponse>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
