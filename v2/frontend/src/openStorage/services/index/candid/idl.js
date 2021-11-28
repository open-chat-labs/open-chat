export const idlFactory = ({ IDL }) => {
  const UserId = IDL.Principal;
  const AddUserArgs = IDL.Record({
    'byte_limit' : IDL.Nat64,
    'user_id' : UserId,
  });
  const AddUserResponse = IDL.Variant({
    'UserAlreadyExists' : IDL.Null,
    'Success' : IDL.Null,
  });
  const Hash = IDL.Vec(IDL.Nat8);
  const AllocatedBucketArgs = IDL.Record({
    'blob_hash' : Hash,
    'blob_size' : IDL.Nat64,
  });
  const CanisterId = IDL.Principal;
  const AllocatedBucketResult = IDL.Record({
    'canister_id' : CanisterId,
    'chunk_size' : IDL.Nat32,
  });
  const AllocatedBucketResponse = IDL.Variant({
    'Success' : AllocatedBucketResult,
    'AllowanceReached' : IDL.Null,
    'UserNotFound' : IDL.Null,
    'BucketUnavailable' : IDL.Null,
  });
  const AccessorId = IDL.Principal;
  const RemoveAccessorArgs = IDL.Record({ 'accessor_id' : AccessorId });
  const RemoveAccessorResponse = IDL.Variant({ 'Success' : IDL.Null });
  const RemoveUserArgs = IDL.Record({ 'user_id' : UserId });
  const RemoveUserResponse = IDL.Variant({ 'Success' : IDL.Null });
  const UpdateUserArgs = IDL.Record({
    'byte_limit' : IDL.Opt(IDL.Nat64),
    'user_id' : UserId,
  });
  const UpdateUserResponse = IDL.Variant({
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
    'add_user' : IDL.Func([AddUserArgs], [AddUserResponse], []),
    'allocated_bucket' : IDL.Func(
        [AllocatedBucketArgs],
        [AllocatedBucketResponse],
        ['query'],
      ),
    'remove_accessor' : IDL.Func(
        [RemoveAccessorArgs],
        [RemoveAccessorResponse],
        [],
      ),
    'remove_user' : IDL.Func([RemoveUserArgs], [RemoveUserResponse], []),
    'update_user' : IDL.Func([UpdateUserArgs], [UpdateUserResponse], []),
    'user' : IDL.Func([UserArgs], [UserResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
