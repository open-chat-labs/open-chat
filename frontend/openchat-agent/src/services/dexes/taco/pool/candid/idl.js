export const idlFactory = ({ IDL }) => {
  const SwapHop = IDL.Record({ 'tokenIn' : IDL.Text, 'tokenOut' : IDL.Text });
  const OptimalSwapLeg = IDL.Record({
    'bp' : IDL.Nat,
    'expectedBuyAmount' : IDL.Nat,
    'route' : IDL.Vec(SwapHop),
    'routeDescription' : IDL.Text,
  });
  const OptimalSwapPlan = IDL.Record({
    'expectedBuyAmount' : IDL.Nat,
    'fee' : IDL.Nat,
    'priceImpact' : IDL.Float64,
    'canFulfillFully' : IDL.Bool,
    'tradingFeeBps' : IDL.Nat,
    'routeDescription' : IDL.Text,
    'legs' : IDL.Vec(OptimalSwapLeg),
  });
  return IDL.Service({
    'getExpectedReceiveAmountBatchMultiOptimal' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Nat],
        [OptimalSwapPlan],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
