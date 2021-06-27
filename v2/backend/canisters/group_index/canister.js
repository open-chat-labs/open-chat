export default ({ IDL }) => {
  const CreateRequest = IDL.Record({
    'is_public' : IDL.Bool,
    'name' : IDL.Text,
  });
  const CanisterId = IDL.Principal;
  const CreateResponse = IDL.Variant({
    'PublicGroupAlreadyExists' : IDL.Null,
    'UnknownError' : IDL.Null,
    'Success' : IDL.Record({ 'canister_id' : CanisterId }),
    'InvalidName' : IDL.Null,
    'NameTooLong' : IDL.Nat16,
    'GroupLimitExceeded' : IDL.Null,
  });
  const GroupId = CanisterId;
  const DeleteRequest = IDL.Record({ 'group_id' : GroupId });
  const DeleteResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Null,
    'NotAdmin' : IDL.Null,
  });
  const Metrics = IDL.Record({
    'cycles_balance' : IDL.Int64,
    'private_group_count' : IDL.Nat64,
    'active_public_group_count' : IDL.Nat64,
    'active_private_group_count' : IDL.Nat64,
    'caller_id' : IDL.Principal,
    'deleted_public_group_count' : IDL.Nat64,
    'bytes_used' : IDL.Nat64,
    'timestamp' : IDL.Nat64,
    'deleted_private_group_count' : IDL.Nat64,
    'public_group_count' : IDL.Nat64,
    'wasm_memory_used' : IDL.Nat64,
  });
  const BalanceNotification = IDL.Record({ 'balance' : IDL.Nat });
  const SearchRequest = IDL.Record({
    'max_results' : IDL.Nat8,
    'search_term' : IDL.Text,
  });
  const SearchResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat16,
    'Success' : IDL.Record({
      'groups' : IDL.Vec(
        IDL.Record({
          'name' : IDL.Text,
          'score' : IDL.Nat32,
          'group_id' : GroupId,
        })
      ),
    }),
    'TermTooLong' : IDL.Nat16,
    'InvalidTerm' : IDL.Null,
  });
  const UpgradeRequest = IDL.Record({
    'wasm' : IDL.Vec(IDL.Nat8),
    'version' : IDL.Text,
  });
  const UpgradeResponse = IDL.Variant({
    'Success' : IDL.Record({ 'canister_id' : CanisterId }),
    'Failure' : IDL.Null,
  });
  return IDL.Service({
    'create' : IDL.Func([CreateRequest], [CreateResponse], []),
    'delete' : IDL.Func([DeleteRequest], [DeleteResponse], []),
    'metrics' : IDL.Func([], [Metrics], ['query']),
    'notify_balance' : IDL.Func([BalanceNotification], [], []),
    'search' : IDL.Func([SearchRequest], [SearchResponse], ['query']),
    'upgrade' : IDL.Func([UpgradeRequest], [UpgradeResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
