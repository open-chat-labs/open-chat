export const idlFactory = ({ IDL }) => {
  const Hash = IDL.Vec(IDL.Nat8);
  const AllocatedBucketArgs = IDL.Record({
    'file_hash' : Hash,
    'file_size' : IDL.Nat64,
    'file_id_seed' : IDL.Opt(IDL.Nat),
  });
  const CanisterId = IDL.Principal;
  const ProjectedAllowance = IDL.Record({
    'bytes_used_after_operation' : IDL.Nat64,
    'byte_limit' : IDL.Nat64,
    'bytes_used_after_upload' : IDL.Nat64,
    'bytes_used' : IDL.Nat64,
  });
  const FileId = IDL.Nat;
  const AllocatedBucketSuccessResult = IDL.Record({
    'byte_limit' : IDL.Nat64,
    'canister_id' : CanisterId,
    'bytes_used_after_upload' : IDL.Nat64,
    'bytes_used' : IDL.Nat64,
    'projected_allowance' : ProjectedAllowance,
    'chunk_size' : IDL.Nat32,
    'file_id' : FileId,
  });
  const AllocatedBucketResponse = IDL.Variant({
    'Success' : AllocatedBucketSuccessResult,
    'AllowanceExceeded' : ProjectedAllowance,
    'UserNotFound' : IDL.Null,
    'BucketUnavailable' : IDL.Null,
  });
  const CanForwardArgs = IDL.Record({
    'file_hash' : Hash,
    'file_size' : IDL.Nat64,
  });
  const CanForwardResponse = IDL.Variant({
    'Success' : ProjectedAllowance,
    'AllowanceExceeded' : ProjectedAllowance,
    'UserNotFound' : IDL.Null,
  });
  const UserArgs = IDL.Record({});
  const UserRecord = IDL.Record({
    'byte_limit' : IDL.Nat64,
    'bytes_used' : IDL.Nat64,
  });
  const UserResponse = IDL.Variant({
    'Success' : UserRecord,
    'UserNotFound' : IDL.Null,
  });
  return IDL.Service({
    'allocated_bucket_v2' : IDL.Func(
        [AllocatedBucketArgs],
        [AllocatedBucketResponse],
        ['query'],
      ),
    'can_forward' : IDL.Func([CanForwardArgs], [CanForwardResponse], ['query']),
    'user' : IDL.Func([UserArgs], [UserResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
