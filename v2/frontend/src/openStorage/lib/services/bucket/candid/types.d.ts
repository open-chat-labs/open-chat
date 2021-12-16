import type { Principal } from "@dfinity/principal";
export declare type AccessorId = Principal;
export declare type BlobId = bigint;
export declare type CanisterId = Principal;
export declare type Cycles = bigint;
export interface DeleteBlobArgs {
    blob_id: BlobId;
}
export declare type DeleteBlobResponse =
    | {
          NotFound: null;
      }
    | {
          NotAuthorized: null;
      }
    | {
          Success: null;
      };
export declare type Hash = Array<number>;
export declare type Milliseconds = bigint;
export declare type TimestampMillis = bigint;
export declare type TimestampNanos = bigint;
export interface UploadChunkArgs {
    accessors: Array<AccessorId>;
    chunk_index: number;
    blob_id: BlobId;
    hash: Hash;
    mime_type: string;
    total_size: bigint;
    bytes: Array<number>;
    chunk_size: number;
}
export declare type UploadChunkResponse =
    | {
          ChunkAlreadyExists: null;
      }
    | {
          BlobTooBig: null;
      }
    | {
          Full: null;
      }
    | {
          ChunkSizeMismatch: null;
      }
    | {
          ChunkIndexTooHigh: null;
      }
    | {
          BlobAlreadyExists: null;
      }
    | {
          Success: null;
      }
    | {
          HashMismatch: null;
      }
    | {
          AllowanceReached: null;
      }
    | {
          UserNotFound: null;
      };
export declare type UserId = Principal;
export interface Version {
    major: number;
    minor: number;
    patch: number;
}
export interface _SERVICE {
    delete_blob: (arg_0: DeleteBlobArgs) => Promise<DeleteBlobResponse>;
    upload_chunk: (arg_0: UploadChunkArgs) => Promise<UploadChunkResponse>;
}
