export const idlFactory = ({ IDL }) => {
  const PairInfoExt = IDL.Record({
    'id' : IDL.Text,
    'price0CumulativeLast' : IDL.Nat,
    'creator' : IDL.Principal,
    'reserve0' : IDL.Nat,
    'reserve1' : IDL.Nat,
    'lptoken' : IDL.Text,
    'totalSupply' : IDL.Nat,
    'token0' : IDL.Text,
    'token1' : IDL.Text,
    'price1CumulativeLast' : IDL.Nat,
    'kLast' : IDL.Nat,
    'blockTimestampLast' : IDL.Int,
  });
  return IDL.Service({
    'getAllPairs' : IDL.Func([], [IDL.Vec(PairInfoExt)], ['query']),
    'getPair' : IDL.Func(
        [IDL.Principal, IDL.Principal],
        [IDL.Opt(PairInfoExt)],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
