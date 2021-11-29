export const idlFactory = ({ IDL }) => {
  const BlobId = IDL.Nat;
  const DeleteBlobArgs = IDL.Record({ 'blob_id' : BlobId });
  const DeleteBlobResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  const AccessorId = IDL.Principal;
  const Hash = IDL.Vec(IDL.Nat8);
  const UploadChunkArgs = IDL.Record({
    'accessors' : IDL.Vec(AccessorId),
    'chunk_index' : IDL.Nat32,
    'blob_id' : BlobId,
    'hash' : Hash,
    'mime_type' : IDL.Text,
    'total_size' : IDL.Nat64,
    'bytes' : IDL.Vec(IDL.Nat8),
    'chunk_size' : IDL.Nat32,
  });
  const UploadChunkResponse = IDL.Variant({
    'ChunkAlreadyExists' : IDL.Null,
    'BlobTooBig' : IDL.Null,
    'Full' : IDL.Null,
    'ChunkSizeMismatch' : IDL.Null,
    'ChunkIndexTooHigh' : IDL.Null,
    'BlobAlreadyExists' : IDL.Null,
    'Success' : IDL.Null,
    'HashMismatch' : IDL.Null,
    'AllowanceReached' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  return IDL.Service({
    'delete_blob' : IDL.Func([DeleteBlobArgs], [DeleteBlobResponse], []),
    'upload_chunk' : IDL.Func([UploadChunkArgs], [UploadChunkResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
