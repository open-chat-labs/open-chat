export const idlFactory = ({ IDL }) => {
    const FileId = IDL.Nat;
    const DeleteFileArgs = IDL.Record({ file_id: FileId });
    const DeleteFileResponse = IDL.Variant({
        NotFound: IDL.Null,
        NotAuthorized: IDL.Null,
        Success: IDL.Null,
    });
    const DeleteFilesArgs = IDL.Record({ file_ids: IDL.Vec(FileId) });
    const DeleteFileFailureReason = IDL.Variant({
        NotFound: IDL.Null,
        NotAuthorized: IDL.Null,
    });
    const DeleteFileFailure = IDL.Record({
        reason: DeleteFileFailureReason,
        file_id: FileId,
    });
    const DeleteFilesResponse = IDL.Record({
        failures: IDL.Vec(DeleteFileFailure),
        success: IDL.Vec(FileId),
    });
    const FileInfoArgs = IDL.Record({ file_id: FileId });
    const Hash = IDL.Vec(IDL.Nat8);
    const FileInfoSuccessResult = IDL.Record({
        is_owner: IDL.Bool,
        file_hash: Hash,
        file_size: IDL.Nat64,
    });
    const FileInfoResponse = IDL.Variant({
        NotFound: IDL.Null,
        Success: FileInfoSuccessResult,
    });
    const AccessorId = IDL.Principal;
    const UserId = IDL.Principal;
    const ForwardFileArgs = IDL.Record({
        accessors: IDL.Vec(AccessorId),
        file_id: FileId,
    });
    const ForwardFileResponse = IDL.Variant({
        NotFound: IDL.Null,
        NotAuthorized: IDL.Null,
        Success: FileId,
        Blocked: IDL.Null,
    });
    const TimestampMillis = IDL.Nat64;
    const UploadChunkArgs = IDL.Record({
        accessors: IDL.Vec(AccessorId),
        chunk_index: IDL.Nat32,
        hash: Hash,
        mime_type: IDL.Text,
        total_size: IDL.Nat64,
        bytes: IDL.Vec(IDL.Nat8),
        expiry: IDL.Opt(TimestampMillis),
        chunk_size: IDL.Nat32,
        file_id: FileId,
        source_hash: IDL.Opt(Hash),
    });
    const VaultFileInfoArgs = IDL.Record({ file_id: FileId });
    const VaultFileInfoResponse = IDL.Variant({
        Success: IDL.Record({
            hash: IDL.Text,
            mime_type: IDL.Text,
            size: IDL.Nat64,
        }),
        NotAuthorized: IDL.Null,
        NotFound: IDL.Null,
    });
    const VaultLogArgs = IDL.Record({
        start: IDL.Nat64,
        max: IDL.Nat32,
        file_id: IDL.Opt(FileId),
    });
    const VaultLogEntry = IDL.Record({
        index: IDL.Nat64,
        timestamp: TimestampMillis,
        hash: IDL.Text,
        prev_hash: IDL.Text,
        event: IDL.Text,
        user_id: IDL.Opt(UserId),
    });
    const VaultLogResponse = IDL.Variant({
        Success: IDL.Record({
            total: IDL.Nat64,
            entries: IDL.Vec(VaultLogEntry),
        }),
        NotAuthorized: IDL.Null,
    });
    const VaultFileChunkArgs = IDL.Record({
        file_id: FileId,
        chunk_index: IDL.Nat32,
        vault_token: IDL.Opt(IDL.Text),
    });
    const VaultFileChunkResponse = IDL.Variant({
        Success: IDL.Record({
            bytes: IDL.Vec(IDL.Nat8),
            chunk_index: IDL.Nat32,
            chunk_count: IDL.Nat32,
            total_size: IDL.Nat64,
            mime_type: IDL.Text,
        }),
        NotAuthorized: IDL.Null,
        NotFound: IDL.Null,
        SessionRequired: IDL.Null,
    });
    const UploadChunkResponse = IDL.Variant({
        ChunkAlreadyExists: IDL.Null,
        Full: IDL.Null,
        ChunkSizeMismatch: IDL.Null,
        FileTooBig: IDL.Null,
        ChunkIndexTooHigh: IDL.Null,
        Success: IDL.Null,
        FileExpired: IDL.Null,
        HashMismatch: IDL.Null,
        FileAlreadyExists: IDL.Null,
        AllowanceExceeded: IDL.Null,
        InvalidFileId: IDL.Null,
        UserNotFound: IDL.Null,
        Blocked: IDL.Null,
    });
    return IDL.Service({
        vault_file_chunk: IDL.Func([VaultFileChunkArgs], [VaultFileChunkResponse], []),
        vault_file_info: IDL.Func([VaultFileInfoArgs], [VaultFileInfoResponse], ["query"]),
        vault_log: IDL.Func([VaultLogArgs], [VaultLogResponse], ["query"]),
        delete_file: IDL.Func([DeleteFileArgs], [DeleteFileResponse], []),
        delete_files: IDL.Func([DeleteFilesArgs], [DeleteFilesResponse], []),
        file_info: IDL.Func([FileInfoArgs], [FileInfoResponse], ["query"]),
        forward_file: IDL.Func([ForwardFileArgs], [ForwardFileResponse], []),
        upload_chunk_v2: IDL.Func([UploadChunkArgs], [UploadChunkResponse], []),
    });
};
export const init = ({ IDL }) => {
    return [];
};
