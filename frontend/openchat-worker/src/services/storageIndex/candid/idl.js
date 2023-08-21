export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const AddBucketCanisterArgs = IDL.Record({ 'canister_id' : CanisterId });
  const AddBucketCanisterResponse = IDL.Variant({
    'BucketAlreadyAdded' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const UserId = CanisterId;
  const UserConfig = IDL.Record({
    'byte_limit' : IDL.Nat64,
    'user_id' : UserId,
  });
  const AddOrUpdateUsersArgs = IDL.Record({ 'users' : IDL.Vec(UserConfig) });
  const AddOrUpdateUsersResponse = IDL.Variant({ 'Success' : IDL.Null });
  const Hash = IDL.Vec(IDL.Nat8);
  const AllocatedBucketArgs = IDL.Record({
    'file_hash' : Hash,
    'file_size' : IDL.Nat64,
    'file_id_seed' : IDL.Opt(IDL.Nat),
  });
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
  const AccessorId = IDL.Principal;
  const RemoveAccessorArgs = IDL.Record({ 'accessor_id' : AccessorId });
  const RemoveAccessorResponse = IDL.Variant({ 'Success' : IDL.Null });
  const RemoveUserArgs = IDL.Record({ 'user_id' : UserId });
  const RemoveUserResponse = IDL.Variant({ 'Success' : IDL.Null });
  const SetBucketFullArgs = IDL.Record({
    'full' : IDL.Bool,
    'bucket' : CanisterId,
  });
  const SetBucketFullResponse = IDL.Variant({ 'Success' : IDL.Null });
  const UpdateUserIdArgs = IDL.Record({
    'old_user_id' : UserId,
    'new_user_id' : UserId,
  });
  const UpdateUserIdResponse = IDL.Variant({
    'UserIdAlreadyExists' : IDL.Null,
    'Success' : IDL.Null,
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
    'add_bucket_canister' : IDL.Func(
        [AddBucketCanisterArgs],
        [AddBucketCanisterResponse],
        [],
      ),
    'add_or_update_users' : IDL.Func(
        [AddOrUpdateUsersArgs],
        [AddOrUpdateUsersResponse],
        [],
      ),
    'allocated_bucket_v2' : IDL.Func(
        [AllocatedBucketArgs],
        [AllocatedBucketResponse],
        ['query'],
      ),
    'can_forward' : IDL.Func([CanForwardArgs], [CanForwardResponse], ['query']),
    'remove_accessor' : IDL.Func(
        [RemoveAccessorArgs],
        [RemoveAccessorResponse],
        [],
      ),
    'remove_user' : IDL.Func([RemoveUserArgs], [RemoveUserResponse], []),
    'set_bucket_full' : IDL.Func(
        [SetBucketFullArgs],
        [SetBucketFullResponse],
        [],
      ),
    'update_user_id' : IDL.Func([UpdateUserIdArgs], [UpdateUserIdResponse], []),
    'user' : IDL.Func([UserArgs], [UserResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
