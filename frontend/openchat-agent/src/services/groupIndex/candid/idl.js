export const idlFactory = ({ IDL }) => {
  const TimestampMillis = IDL.Nat64;
  const CanisterId = IDL.Principal;
  const ChatId = CanisterId;
  const FilterGroupsArgs = IDL.Record({
    'active_since' : IDL.Opt(TimestampMillis),
    'chat_ids' : IDL.Vec(ChatId),
  });
  const UserId = CanisterId;
  const DeletedGroupInfo = IDL.Record({
    'id' : ChatId,
    'public' : IDL.Bool,
    'timestamp' : TimestampMillis,
    'deleted_by' : UserId,
    'group_name' : IDL.Text,
  });
  const FilterGroupsResponse = IDL.Variant({
    'Success' : IDL.Record({
      'upgrades_in_progress' : IDL.Vec(ChatId),
      'deleted_groups' : IDL.Vec(DeletedGroupInfo),
      'active_groups' : IDL.Vec(ChatId),
      'timestamp' : TimestampMillis,
    }),
  });
  const FreezeGroupArgs = IDL.Record({
    'chat_id' : ChatId,
    'reason' : IDL.Opt(IDL.Text),
  });
  const ChatFrozen = IDL.Record({
    'frozen_by' : UserId,
    'reason' : IDL.Opt(IDL.Text),
  });
  const EventIndex = IDL.Nat32;
  const FreezeGroupResponse = IDL.Variant({
    'ChatAlreadyFrozen' : IDL.Null,
    'ChatNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({
      'event' : ChatFrozen,
      'timestamp' : TimestampMillis,
      'index' : EventIndex,
      'correlation_id' : IDL.Nat64,
    }),
    'InternalError' : IDL.Text,
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
  const UnfreezeGroupArgs = IDL.Record({ 'chat_id' : ChatId });
  const ChatUnfrozen = IDL.Record({ 'unfrozen_by' : UserId });
  const UnfreezeGroupResponse = IDL.Variant({
    'ChatNotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Record({
      'event' : ChatUnfrozen,
      'timestamp' : TimestampMillis,
      'index' : EventIndex,
      'correlation_id' : IDL.Nat64,
    }),
    'ChatNotFrozen' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  return IDL.Service({
    'filter_groups' : IDL.Func(
        [FilterGroupsArgs],
        [FilterGroupsResponse],
        ['query'],
      ),
    'freeze_group' : IDL.Func([FreezeGroupArgs], [FreezeGroupResponse], []),
    'search' : IDL.Func([SearchArgs], [SearchResponse], ['query']),
    'unfreeze_group' : IDL.Func(
        [UnfreezeGroupArgs],
        [UnfreezeGroupResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
