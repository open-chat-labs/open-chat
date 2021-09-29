export const idlFactory = ({ IDL }) => {
  const Milliseconds = IDL.Nat64;
  const CanisterId = IDL.Principal;
  const ChatId = CanisterId;
  const ActiveGroupsArgs = IDL.Record({
    'active_in_last' : Milliseconds,
    'chat_ids' : IDL.Vec(ChatId),
  });
  const ActiveGroupsSuccessResult = IDL.Record({
    'active_groups' : IDL.Vec(ChatId),
  });
  const ActiveGroupsResponse = IDL.Variant({
    'Success' : ActiveGroupsSuccessResult,
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
  const SearchArgs = IDL.Record({
    'max_results' : IDL.Nat8,
    'search_term' : IDL.Text,
  });
  const GroupMatch = IDL.Record({
    'name' : IDL.Text,
    'description' : IDL.Text,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'chat_id' : ChatId,
  });
  const SearchSuccessResult = IDL.Record({ 'matches' : IDL.Vec(GroupMatch) });
  const SearchResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat8,
    'Success' : SearchSuccessResult,
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
  });
  return IDL.Service({
    'active_groups' : IDL.Func(
        [ActiveGroupsArgs],
        [ActiveGroupsResponse],
        ['query'],
      ),
    'metrics' : IDL.Func([MetricsArgs], [MetricsResponse], ['query']),
    'search' : IDL.Func([SearchArgs], [SearchResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
