import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

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
  'code' : string,
  'expiration' : bigint,
}
export interface GetDelegationArgs {
  'session_key' : Uint8Array | number[],
  'email' : string,
  'expiration' : bigint,
}
export type GetDelegationResponse = { 'NotFound' : null } |
  { 'Success' : SignedDelegation };
export interface HttpRequest {
  'url' : string,
  'method' : string,
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
}
export interface HttpResponse {
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
  'upgrade' : [] | [boolean],
  'status_code' : number,
}
export interface InitArgs {
  'salt' : [] | [Uint8Array | number[]],
  'email_sender_public_key_pem' : string,
}
export type InitOrUpgradeArgs = { 'Upgrade' : UpgradeArgs } |
  { 'Init' : InitArgs };
export interface SignedDelegation {
  'signature' : Uint8Array | number[],
  'delegation' : Delegation,
}
export interface UpgradeArgs {
  'email_sender_public_key_pem' : [] | [string],
  'email_sender_config' : [] | [EncryptedEmailSenderConfig],
}
export interface _SERVICE {
  'generate_magic_link' : ActorMethod<
    [GenerateMagicLinkArgs],
    GenerateMagicLinkResponse
  >,
  'get_delegation' : ActorMethod<[GetDelegationArgs], GetDelegationResponse>,
  'http_request' : ActorMethod<[HttpRequest], HttpResponse>,
  'http_request_update' : ActorMethod<[HttpRequest], HttpResponse>,
  'rsa_public_key' : ActorMethod<[], [] | [string]>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
