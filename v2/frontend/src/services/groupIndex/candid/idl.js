export const idlFactory = ({ IDL }) => {
  const CreateArgs = IDL.Record({ 'is_public' : IDL.Bool, 'name' : IDL.Text });
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
  const DeleteArgs = IDL.Record({ 'group_id' : GroupId });
  const DeleteResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Null,
    'NotAdmin' : IDL.Null,
  });
  const MetricsArgs = IDL.Record({});
  const TimestampMillis = IDL.Nat64;
  const MetricsResponse = IDL.Record({
    'cycles_balance' : IDL.Int64,
    'private_group_count' : IDL.Nat64,
    'active_public_group_count' : IDL.Nat64,
    'active_private_group_count' : IDL.Nat64,
    'caller_id' : IDL.Principal,
    'deleted_public_group_count' : IDL.Nat64,
    'bytes_used' : IDL.Nat64,
    'timestamp' : TimestampMillis,
    'deleted_private_group_count' : IDL.Nat64,
    'public_group_count' : IDL.Nat64,
    'wasm_memory_used' : IDL.Nat64,
  });
  const NotifyBalanceArgs = IDL.Record({ 'balance' : IDL.Nat });
  const SearchArgs = IDL.Record({
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
  const UpgradeArgs = IDL.Record({
    'wasm' : IDL.Vec(IDL.Nat8),
    'version' : IDL.Text,
  });
  const UpgradeResponse = IDL.Variant({
    'Success' : IDL.Record({ 'canister_id' : CanisterId }),
    'Failure' : IDL.Null,
  });
  return IDL.Service({
    'create' : IDL.Func([CreateArgs], [CreateResponse], []),
    'delete' : IDL.Func([DeleteArgs], [DeleteResponse], []),
    'metrics' : IDL.Func([MetricsArgs], [MetricsResponse], ['query']),
    'notify_balance' : IDL.Func([NotifyBalanceArgs], [], []),
    'search' : IDL.Func([SearchArgs], [SearchResponse], ['query']),
    'upgrade' : IDL.Func([UpgradeArgs], [UpgradeResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
