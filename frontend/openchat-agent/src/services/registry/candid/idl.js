export const idlFactory = ({ IDL }) => {
  const TimestampMillis = IDL.Nat64;
  const UpdatesArgs = IDL.Record({ 'since' : IDL.Opt(TimestampMillis) });
  const CanisterId = IDL.Principal;
  const TokenDetails = IDL.Record({
    'fee' : IDL.Nat,
    'decimals' : IDL.Nat8,
    'added' : TimestampMillis,
    'how_to_buy_url' : IDL.Text,
    'info_url' : IDL.Text,
    'logo' : IDL.Text,
    'name' : IDL.Text,
    'last_updated' : TimestampMillis,
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
  const UpdatesResponse = IDL.Variant({
    'Success' : IDL.Record({
      'last_updated' : TimestampMillis,
      'token_details' : IDL.Opt(IDL.Vec(TokenDetails)),
      'nervous_system_details' : IDL.Vec(NervousSystemSummary),
    }),
    'SuccessNoUpdates' : IDL.Null,
  });
  return IDL.Service({
    'updates' : IDL.Func([UpdatesArgs], [UpdatesResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
