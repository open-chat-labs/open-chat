export const idlFactory = ({ IDL }) => {
  const PublicTokenOverview = IDL.Record({
    'volumeUSD7d' : IDL.Float64,
    'address' : IDL.Text,
    'priceUSD' : IDL.Float64,
    'symbol' : IDL.Text,
  });
  return IDL.Service({
    'getAllTokens' : IDL.Func([], [IDL.Vec(PublicTokenOverview)], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
