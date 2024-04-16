import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Delegation {
  'pubkey' : Uint8Array | number[],
  'expiration' : bigint,
}
export interface EncryptedAwsEmailSenderConfig {
  'region' : string,
  'secret_key_encrypted' : string,
  'target_arn' : string,
  'access_key_encrypted' : string,
}
export type EncryptedEmailSenderConfig = {
    'Aws' : EncryptedAwsEmailSenderConfig
  };
export interface GenerateVerificationCodeArgs { 'email' : string }
export type GenerateVerificationCodeResponse = { 'Blocked' : bigint } |
  { 'EmailInvalid' : null } |
  { 'FailedToSendEmail' : string } |
  { 'Success' : null };
export interface GetDelegationArgs {
  'session_key' : Uint8Array | number[],
  'email' : string,
  'expiration' : bigint,
}
export type GetDelegationResponse = { 'NotFound' : null } |
  { 'Success' : SignedDelegation };
export interface InitArgs { 'test_mode' : boolean }
export type InitOrUpgradeArgs = { 'Upgrade' : UpgradeArgs } |
  { 'Init' : InitArgs };
export interface SignedDelegation {
  'signature' : Uint8Array | number[],
  'delegation' : Delegation,
}
export interface SubmitVerificationCodeArgs {
  'session_key' : Uint8Array | number[],
  'code' : string,
  'email' : string,
  'max_time_to_live' : [] | [bigint],
}
export type SubmitVerificationCodeResponse = { 'NotFound' : null } |
  { 'Success' : SubmitVerificationCodeSuccess } |
  { 'IncorrectCode' : null };
export interface SubmitVerificationCodeSuccess {
  'user_key' : Uint8Array | number[],
  'expiration' : bigint,
}
export interface UpgradeArgs {
  'email_sender_config' : [] | [EncryptedEmailSenderConfig],
}
export interface _SERVICE {
  'generate_verification_code' : ActorMethod<
    [GenerateVerificationCodeArgs],
    GenerateVerificationCodeResponse
  >,
  'get_delegation' : ActorMethod<[GetDelegationArgs], GetDelegationResponse>,
  'rsa_public_key' : ActorMethod<[], [] | [string]>,
  'submit_verification_code' : ActorMethod<
    [SubmitVerificationCodeArgs],
    SubmitVerificationCodeResponse
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
