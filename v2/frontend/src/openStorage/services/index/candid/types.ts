import type { Principal } from '@dfinity/principal';
export type AccessorId = Principal;
export interface AddUserArgs { 'byte_limit' : bigint, 'user_id' : UserId }
export type AddUserResponse = { 'UserAlreadyExists' : null } |
  { 'Success' : null };
export interface AllocatedBucketArgs {
  'blob_hash' : Hash,
  'blob_size' : bigint,
}
export type AllocatedBucketResponse = { 'Success' : AllocatedBucketResult } |
  { 'AllowanceReached' : null } |
  { 'UserNotFound' : null } |
  { 'BucketUnavailable' : null };
export interface AllocatedBucketResult {
  'canister_id' : CanisterId,
  'chunk_size' : number,
}
export type BlobId = bigint;
export type CanisterId = Principal;
export type Cycles = bigint;
export type Hash = bigint;
export type Milliseconds = bigint;
export interface RemoveAccessorArgs { 'accessor_id' : AccessorId }
export type RemoveAccessorResponse = { 'Success' : null };
export interface RemoveUserArgs { 'user_id' : UserId }
export type RemoveUserResponse = { 'Success' : null };
export type TimestampMillis = bigint;
export type TimestampNanos = bigint;
export interface UpdateUserArgs {
  'byte_limit' : [] | [bigint],
  'user_id' : UserId,
}
export type UpdateUserResponse = { 'Success' : null } |
  { 'UserNotFound' : null };
export type UserArgs = {};
export type UserId = Principal;
export interface UserRecord { 'byte_limit' : bigint, 'bytes_used' : bigint }
export type UserResponse = { 'Success' : UserRecord } |
  { 'UserNotFound' : null };
export interface Version {
  'major' : number,
  'minor' : number,
  'patch' : number,
}
export interface _SERVICE {
  'add_user' : (arg_0: AddUserArgs) => Promise<AddUserResponse>,
  'allocated_bucket' : (arg_0: AllocatedBucketArgs) => Promise<
      AllocatedBucketResponse
    >,
  'remove_accessor' : (arg_0: RemoveAccessorArgs) => Promise<
      RemoveAccessorResponse
    >,
  'remove_user' : (arg_0: RemoveUserArgs) => Promise<RemoveUserResponse>,
  'update_user' : (arg_0: UpdateUserArgs) => Promise<UpdateUserResponse>,
  'user' : (arg_0: UserArgs) => Promise<UserResponse>,
}
