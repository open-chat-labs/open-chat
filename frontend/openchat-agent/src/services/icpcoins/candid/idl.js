export const idlFactory = ({ IDL }) => {
  const GetCoinsByMarketcapReq = IDL.Record({
    'from' : IDL.Opt(IDL.Nat64),
    'full' : IDL.Bool,
    'select' : IDL.Opt(IDL.Vec(IDL.Text)),
  });
  const PKKey = IDL.Nat32;
  const Value = IDL.Float64;
  const CoinWithDetails = IDL.Record({
    'id' : PKKey,
    'decimals' : IDL.Nat8,
    'deleted' : IDL.Bool,
    'name' : IDL.Text,
    'rank' : IDL.Nat32,
    'tags' : IDL.Vec(IDL.Text),
    'ledger_id' : IDL.Text,
    'details_json' : IDL.Text,
    'details' : IDL.Vec(IDL.Tuple(IDL.Text, Value)),
    'overview_json' : IDL.Text,
    'symbol' : IDL.Text,
    'unlisted' : IDL.Bool,
  });
  const GetCoinsByMarketcapResp = IDL.Record({
    'last' : IDL.Opt(IDL.Nat64),
    'coins' : IDL.Vec(CoinWithDetails),
  });
  return IDL.Service({
    'get_coins_by_marketcap' : IDL.Func(
        [GetCoinsByMarketcapReq],
        [GetCoinsByMarketcapResp],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
