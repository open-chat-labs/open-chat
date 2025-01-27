import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface ApproveIdentityLinkArgs {
  'link_initiated_by' : Principal,
  'public_key' : Uint8Array | number[],
  'delegation' : SignedDelegation,
}
export type ApproveIdentityLinkResponse = { 'LinkRequestNotFound' : null } |
  { 'InvalidSignature' : null } |
  { 'PrincipalAlreadyLinkedToAnotherOcUser' : null } |
  { 'Success' : null } |
  { 'MalformedSignature' : string } |
  { 'DelegationTooOld' : null } |
  { 'CallerNotRecognised' : null };
export type AuthPrincipalsResponse = { 'NotFound' : null } |
  {
    'Success' : Array<
      {
        'principal' : Principal,
        'originating_canister' : Principal,
        'is_ii_principal' : boolean,
      }
    >
  };
export type CheckAuthPrincipalResponse = { 'NotFound' : null } |
  { 'Success' : null };
export interface CreateIdentityArgs {
  'public_key' : PublicKey,
  'session_key' : PublicKey,
  'max_time_to_live' : [] | [Nanoseconds],
  'is_ii_principal' : [] | [boolean],
  'challenge_attempt' : [] | [{ 'key' : number, 'chars' : string }],
}
export type CreateIdentityResponse = { 'AlreadyRegistered' : null } |
  { 'OriginatingCanisterInvalid' : Principal } |
  { 'Success' : PrepareDelegationSuccess } |
  { 'ChallengeFailed' : null } |
  { 'ChallengeRequired' : null } |
  { 'PublicKeyInvalid' : string };
export type GenerateChallengeResponse = { 'AlreadyRegistered' : null } |
  { 'Throttled' : null } |
  { 'Success' : { 'key' : number, 'png_base64' : string } };
export interface GetDelegationArgs {
  'session_key' : PublicKey,
  'expiration' : TimestampNanoseconds,
}
export type GetDelegationResponse = { 'NotFound' : null } |
  { 'Success' : SignedDelegation };
export interface InitiateIdentityLinkArgs {
  'public_key' : Uint8Array | number[],
  'link_to_principal' : Principal,
  'is_ii_principal' : [] | [boolean],
}
export type InitiateIdentityLinkResponse = { 'AlreadyRegistered' : null } |
  { 'Success' : null } |
  { 'TargetUserNotFound' : null } |
  { 'PublicKeyInvalid' : string } |
  { 'AlreadyLinkedToPrincipal' : null };
export type Nanoseconds = bigint;
export interface PrepareDelegationArgs {
  'session_key' : PublicKey,
  'max_time_to_live' : [] | [Nanoseconds],
  'is_ii_principal' : [] | [boolean],
}
export type PrepareDelegationResponse = { 'NotFound' : null } |
  { 'Success' : PrepareDelegationSuccess };
export interface PrepareDelegationSuccess {
  'user_key' : PublicKey,
  'expiration' : TimestampNanoseconds,
}
export type PublicKey = Uint8Array | number[];
export interface RemoveIdentityLinkArgs { 'linked_principal' : Principal }
export type RemoveIdentityLinkResponse = {
    'CannotUnlinkActivePrincipal' : null
  } |
  { 'Success' : null } |
  { 'IdentityLinkNotFound' : null } |
  { 'UserNotFound' : null };
export interface SignedDelegation {
  'signature' : Uint8Array | number[],
  'delegation' : { 'pubkey' : PublicKey, 'expiration' : TimestampNanoseconds },
}
export type TimestampNanoseconds = bigint;
export interface _SERVICE {
  'approve_identity_link' : ActorMethod<
    [ApproveIdentityLinkArgs],
    ApproveIdentityLinkResponse
  >,
  'auth_principals' : ActorMethod<[{}], AuthPrincipalsResponse>,
  'check_auth_principal' : ActorMethod<[{}], CheckAuthPrincipalResponse>,
  'create_identity' : ActorMethod<[CreateIdentityArgs], CreateIdentityResponse>,
  'generate_challenge' : ActorMethod<[{}], GenerateChallengeResponse>,
  'get_delegation' : ActorMethod<[GetDelegationArgs], GetDelegationResponse>,
  'initiate_identity_link' : ActorMethod<
    [InitiateIdentityLinkArgs],
    InitiateIdentityLinkResponse
  >,
  'prepare_delegation' : ActorMethod<
    [PrepareDelegationArgs],
    PrepareDelegationResponse
  >,
  'remove_identity_link' : ActorMethod<
    [RemoveIdentityLinkArgs],
    RemoveIdentityLinkResponse
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
