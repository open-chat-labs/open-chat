export const idlFactory = ({ IDL }) => {
  const AMMPool = IDL.Record({
    'token0' : IDL.Text,
    'token1' : IDL.Text,
    'reserve0' : IDL.Nat,
    'reserve1' : IDL.Nat,
    'price0' : IDL.Float64,
    'price1' : IDL.Float64,
    'totalLiquidity' : IDL.Nat,
  });
  return IDL.Service({
    'getAllAMMPools' : IDL.Func([], [IDL.Vec(AMMPool)], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
