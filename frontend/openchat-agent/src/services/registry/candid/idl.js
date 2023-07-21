export const idlFactory = ({ IDL }) => {
  const TimestampMillis = IDL.Nat64;
  const UpdatesArgs = IDL.Record({ 'since' : IDL.Opt(TimestampMillis) });
  const CanisterId = IDL.Principal;
  const TokenDetails = IDL.Record({
    'fee' : IDL.Nat,
    'decimals' : IDL.Nat8,
    'added' : TimestampMillis,
    'how_to_buy_url' : IDL.Opt(IDL.Text),
    'info_url' : IDL.Opt(IDL.Text),
    'logo' : IDL.Opt(IDL.Text),
    'name' : IDL.Text,
    'last_updated' : TimestampMillis,
    'sns_canisters' : IDL.Opt(
      IDL.Record({ 'root' : CanisterId, 'governance' : CanisterId })
    ),
    'ledger_canister_id' : CanisterId,
    'symbol' : IDL.Text,
    'transaction_url_format' : IDL.Opt(IDL.Text),
  });
  const UpdatesResponse = IDL.Variant({
    'Success' : IDL.Record({
      'last_updated' : TimestampMillis,
      'token_details' : IDL.Opt(IDL.Vec(TokenDetails)),
    }),
    'SuccessNoUpdates' : IDL.Null,
  });
  return IDL.Service({
    'updates' : IDL.Func([UpdatesArgs], [UpdatesResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
