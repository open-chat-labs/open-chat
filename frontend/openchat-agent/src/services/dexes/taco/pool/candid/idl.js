export const idlFactory = ({ IDL }) => {
  const HopDetail = IDL.Record({
    'tokenIn' : IDL.Text,
    'tokenOut' : IDL.Text,
    'amountIn' : IDL.Nat,
    'amountOut' : IDL.Nat,
    'fee' : IDL.Nat,
    'priceImpact' : IDL.Float64,
  });
  const PotentialOrderDetails = IDL.Record({
    'amount_init' : IDL.Nat,
    'amount_sell' : IDL.Nat,
  });
  const QuoteResponse = IDL.Record({
    'expectedBuyAmount' : IDL.Nat,
    'fee' : IDL.Nat,
    'priceImpact' : IDL.Float64,
    'routeDescription' : IDL.Text,
    'canFulfillFully' : IDL.Bool,
    'potentialOrderDetails' : IDL.Opt(PotentialOrderDetails),
    'hopDetails' : IDL.Vec(HopDetail),
  });
  return IDL.Service({
    'getExpectedReceiveAmount' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Nat],
        [QuoteResponse],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
