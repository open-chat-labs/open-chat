export const idlFactory = ({ IDL }) => {
  const FileId = IDL.Nat;
  const DeleteFileArgs = IDL.Record({ 'file_id' : FileId });
  const DeleteFileResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
  });
  const DeleteFilesArgs = IDL.Record({ 'file_ids' : IDL.Vec(FileId) });
  const DeleteFileFailureReason = IDL.Variant({
    'NotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
  });
  const DeleteFileFailure = IDL.Record({
    'reason' : DeleteFileFailureReason,
    'file_id' : FileId,
  });
  const DeleteFilesResponse = IDL.Record({
    'failures' : IDL.Vec(DeleteFileFailure),
    'success' : IDL.Vec(FileId),
  });
  const FileInfoArgs = IDL.Record({ 'file_id' : FileId });
  const Hash = IDL.Vec(IDL.Nat8);
  const FileInfoSuccessResult = IDL.Record({
    'is_owner' : IDL.Bool,
    'file_hash' : Hash,
    'file_size' : IDL.Nat64,
  });
  const FileInfoResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : FileInfoSuccessResult,
  });
  const AccessorId = IDL.Principal;
  const ForwardFileArgs = IDL.Record({
    'accessors' : IDL.Vec(AccessorId),
    'file_id' : FileId,
  });
  const ForwardFileResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : FileId,
  });
  const TimestampMillis = IDL.Nat64;
  const UploadChunkArgs = IDL.Record({
    'accessors' : IDL.Vec(AccessorId),
    'chunk_index' : IDL.Nat32,
    'hash' : Hash,
    'mime_type' : IDL.Text,
    'total_size' : IDL.Nat64,
    'bytes' : IDL.Vec(IDL.Nat8),
    'expiry' : IDL.Opt(TimestampMillis),
    'chunk_size' : IDL.Nat32,
    'file_id' : FileId,
  });
  const UploadChunkResponse = IDL.Variant({
    'ChunkAlreadyExists' : IDL.Null,
    'Full' : IDL.Null,
    'ChunkSizeMismatch' : IDL.Null,
    'FileTooBig' : IDL.Null,
    'ChunkIndexTooHigh' : IDL.Null,
    'Success' : IDL.Null,
    'FileExpired' : IDL.Null,
    'HashMismatch' : IDL.Null,
    'FileAlreadyExists' : IDL.Null,
    'AllowanceExceeded' : IDL.Null,
    'InvalidFileId' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  return IDL.Service({
    'delete_file' : IDL.Func([DeleteFileArgs], [DeleteFileResponse], []),
    'delete_files' : IDL.Func([DeleteFilesArgs], [DeleteFilesResponse], []),
    'file_info' : IDL.Func([FileInfoArgs], [FileInfoResponse], ['query']),
    'forward_file' : IDL.Func([ForwardFileArgs], [ForwardFileResponse], []),
    'upload_chunk_v2' : IDL.Func([UploadChunkArgs], [UploadChunkResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
