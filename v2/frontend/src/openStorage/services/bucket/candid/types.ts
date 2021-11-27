import type { Principal } from '@dfinity/principal';
export type AccessorId = Principal;
export type BlobId = bigint;
export type CanisterId = Principal;
export type Cycles = bigint;
export interface DeleteBlobArgs { 'blob_id' : BlobId }
export type DeleteBlobResponse = { 'NotFound' : null } |
  { 'NotAuthorized' : null } |
  { 'Success' : null };
export type Hash = bigint;
export type Milliseconds = bigint;
export type TimestampMillis = bigint;
export type TimestampNanos = bigint;
export interface UploadChunkArgs {
  'accessors' : Array<AccessorId>,
  'chunk_index' : number,
  'blob_id' : BlobId,
  'hash' : Hash,
  'mime_type' : string,
  'total_size' : bigint,
  'bytes' : Array<number>,
  'chunk_size' : number,
}
export type UploadChunkResponse = { 'ChunkAlreadyExists' : null } |
  { 'BlobTooBig' : bigint } |
  { 'Full' : null } |
  { 'BlobAlreadyExists' : null } |
  { 'Success' : null } |
  { 'HashMismatch' : null } |
  { 'AllowanceReached' : null } |
  { 'UserNotFound' : null };
export type UserId = Principal;
export interface Version {
  'major' : number,
  'minor' : number,
  'patch' : number,
}
export interface _SERVICE {
  'delete_blob' : (arg_0: DeleteBlobArgs) => Promise<DeleteBlobResponse>,
  'upload_chunk' : (arg_0: UploadChunkArgs) => Promise<UploadChunkResponse>,
}
