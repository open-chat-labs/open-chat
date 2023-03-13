export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const Avatar = IDL.Record({
    'id' : IDL.Nat,
    'data' : IDL.Vec(IDL.Nat8),
    'mime_type' : IDL.Text,
  });
  const AddGovernanceCanisterArgs = IDL.Record({
    'name' : IDL.Text,
    'description' : IDL.Opt(IDL.Text),
    'governance_canister_id' : CanisterId,
    'avatar' : IDL.Opt(Avatar),
  });
  const AddGovernanceCanisterResponse = IDL.Variant({
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
    'AlreadyAdded' : IDL.Null,
  });
  const RemoveGovernanceCanisterArgs = IDL.Record({
    'governance_canister_id' : CanisterId,
    'delete_group' : IDL.Bool,
  });
  const RemoveGovernanceCanisterResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const AvatarUpdate = IDL.Variant({
    'NoChange' : IDL.Null,
    'SetToNone' : IDL.Null,
    'SetToSome' : Avatar,
  });
  const UpdateGroupDetailsArgs = IDL.Record({
    'name' : IDL.Opt(IDL.Text),
    'description' : IDL.Opt(IDL.Text),
    'governance_canister_id' : CanisterId,
    'avatar' : AvatarUpdate,
  });
  const UpdateGroupDetailsResponse = IDL.Variant({
    'DescriptionTooLong' : IDL.Null,
    'NameTooShort' : IDL.Null,
    'NotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'AvatarTooBig' : IDL.Null,
    'Success' : IDL.Null,
    'NameTooLong' : IDL.Null,
    'NameTaken' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  return IDL.Service({
    'add_governance_canister' : IDL.Func(
        [AddGovernanceCanisterArgs],
        [AddGovernanceCanisterResponse],
        [],
      ),
    'remove_governance_canister' : IDL.Func(
        [RemoveGovernanceCanisterArgs],
        [RemoveGovernanceCanisterResponse],
        [],
      ),
    'update_group_details' : IDL.Func(
        [UpdateGroupDetailsArgs],
        [UpdateGroupDetailsResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
