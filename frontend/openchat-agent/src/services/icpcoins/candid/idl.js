export const idlFactory = ({ IDL }) => {
  const TokenId = IDL.Nat;
  const LatestTokenRow = IDL.Tuple(
    IDL.Tuple(TokenId, TokenId),
    IDL.Text,
    IDL.Float64,
  );
  return IDL.Service({
    'get_latest' : IDL.Func([], [IDL.Vec(LatestTokenRow)], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
