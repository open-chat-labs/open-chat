import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type CheckAuthPrincipalResponse = { 'NotFound' : null } |
  { 'Success' : null } |
  { 'Legacy' : null };
export interface CreateIdentityArgs {
  'public_key' : PublicKey,
  'session_key' : PublicKey,
  'max_time_to_live' : [] | [Nanoseconds],
  'challenge_attempt' : [] | [{ 'key' : number, 'chars' : string }],
}
export type CreateIdentityResponse = { 'AlreadyRegistered' : null } |
  {
    'Success' : {
      'principal' : Principal,
      'user_key' : PublicKey,
      'expiration' : TimestampNanoseconds,
    }
  } |
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
export interface SetPrincipalMigrationJobEnabledArgs { 'enabled' : boolean }
export type SetPrincipalMigrationJobEnabledResponse = { 'Success' : null };
export interface SignedDelegation {
  'signature' : Uint8Array | number[],
  'delegation' : { 'pubkey' : PublicKey, 'expiration' : TimestampNanoseconds },
}
export type TimestampNanoseconds = bigint;
export interface _SERVICE {
  'check_auth_principal' : ActorMethod<[{}], CheckAuthPrincipalResponse>,
  'create_identity' : ActorMethod<[CreateIdentityArgs], CreateIdentityResponse>,
  'generate_challenge' : ActorMethod<[{}], GenerateChallengeResponse>,
  'get_delegation' : ActorMethod<[GetDelegationArgs], GetDelegationResponse>,
  'migrate_legacy_principal' : ActorMethod<
    [{}],
    MigrateLegacyPrincipalResponse
  >,
  'prepare_delegation' : ActorMethod<
    [PrepareDelegationArgs],
    PrepareDelegationResponse
  >,
  'set_principal_migration_job_enabled' : ActorMethod<
    [SetPrincipalMigrationJobEnabledArgs],
    SetPrincipalMigrationJobEnabledResponse
  >,
}
