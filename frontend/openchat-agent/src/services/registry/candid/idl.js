export const idlFactory = ({ IDL }) => {
  const AddMessageFilterArgs = IDL.Record({ 'regex' : IDL.Text });
  const AddMessageFilterResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Nat64,
    'InvalidRequest' : IDL.Text,
    'InternalError' : IDL.Text,
    'AlreadyAdded' : IDL.Null,
  });
  const RemoveMessageFilterArgs = IDL.Record({ 'id' : IDL.Nat64 });
  const RemoveMessageFilterResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const CanisterId = IDL.Principal;
  const SetTokenEnabledArgs = IDL.Record({
    'enabled' : IDL.Bool,
    'ledger_canister_id' : CanisterId,
  });
  const SetTokenEnabledResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const TimestampMillis = IDL.Nat64;
  const UpdatesArgs = IDL.Record({ 'since' : IDL.Opt(TimestampMillis) });
  const TokenDetails = IDL.Record({
    'fee' : IDL.Nat,
    'decimals' : IDL.Nat8,
    'added' : TimestampMillis,
    'how_to_buy_url' : IDL.Text,
    'info_url' : IDL.Text,
    'logo' : IDL.Text,
    'name' : IDL.Text,
    'last_updated' : TimestampMillis,
    'enabled' : IDL.Bool,
    'logo_id' : IDL.Opt(IDL.Nat),
    'ledger_canister_id' : CanisterId,
    'supported_standards' : IDL.Vec(IDL.Text),
    'symbol' : IDL.Text,
    'transaction_url_format' : IDL.Text,
  });
  const NervousSystemSummary = IDL.Record({
    'root_canister_id' : CanisterId,
    'submitting_proposals_enabled' : IDL.Bool,
    'is_nns' : IDL.Bool,
    'governance_canister_id' : CanisterId,
    'index_canister_id' : CanisterId,
    'proposal_rejection_fee' : IDL.Nat64,
    'ledger_canister_id' : CanisterId,
  });
  const MessageFilterSummary = IDL.Record({
    'id' : IDL.Nat64,
    'regex' : IDL.Text,
  });
  const UpdatesResponse = IDL.Variant({
    'Success' : IDL.Record({
      'last_updated' : TimestampMillis,
      'token_details' : IDL.Opt(IDL.Vec(TokenDetails)),
      'nervous_system_details' : IDL.Vec(NervousSystemSummary),
      'message_filters_removed' : IDL.Vec(IDL.Nat64),
      'message_filters_added' : IDL.Vec(MessageFilterSummary),
    }),
    'SuccessNoUpdates' : IDL.Null,
  });
  return IDL.Service({
    'add_message_filter' : IDL.Func(
        [AddMessageFilterArgs],
        [AddMessageFilterResponse],
        [],
      ),
    'remove_message_filter' : IDL.Func(
        [RemoveMessageFilterArgs],
        [RemoveMessageFilterResponse],
        [],
      ),
    'set_token_enabled' : IDL.Func(
        [SetTokenEnabledArgs],
        [SetTokenEnabledResponse],
        [],
      ),
    'updates' : IDL.Func([UpdatesArgs], [UpdatesResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
