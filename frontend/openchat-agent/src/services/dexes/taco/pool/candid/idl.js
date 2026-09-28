export const idlFactory = ({ IDL }) => {
  const SwapHop = IDL.Record({ 'tokenIn' : IDL.Text, 'tokenOut' : IDL.Text });
  const OptimalSwapLeg = IDL.Record({
    'bp' : IDL.Nat,
    'routeDescription' : IDL.Text,
    'route' : IDL.Vec(SwapHop),
    'expectedBuyAmount' : IDL.Nat,
  });
  const OptimalSwapPlan = IDL.Record({
    'fee' : IDL.Nat,
    'tradingFeeBps' : IDL.Nat,
    'routeDescription' : IDL.Text,
    'canFulfillFully' : IDL.Bool,
    'legs' : IDL.Vec(OptimalSwapLeg),
    'priceImpact' : IDL.Float64,
    'expectedBuyAmount' : IDL.Nat,
  });
  const SwapOk = IDL.Record({
    'fee' : IDL.Nat,
    'tokenIn' : IDL.Text,
    'tokenOut' : IDL.Text,
    'hops' : IDL.Nat,
    'firstHopOrderbookMatch' : IDL.Bool,
    'amountIn' : IDL.Nat,
    'amountOut' : IDL.Nat,
    'swapId' : IDL.Nat,
    'route' : IDL.Vec(IDL.Text),
    'lastHopAMMOnly' : IDL.Bool,
  });
  const ExchangeError = IDL.Variant({
    'InvalidInput' : IDL.Text,
    'PoolNotFound' : IDL.Text,
    'SystemError' : IDL.Text,
    'OrderNotFound' : IDL.Text,
    'TokenPaused' : IDL.Text,
    'NotAuthorized' : IDL.Null,
    'RouteFailed' : IDL.Record({ 'hop' : IDL.Nat, 'reason' : IDL.Text }),
    'Banned' : IDL.Null,
    'ExchangeFrozen' : IDL.Null,
    'TransferFailed' : IDL.Text,
    'SlippageExceeded' : IDL.Record({ 'got' : IDL.Nat, 'expected' : IDL.Nat }),
    'TokenNotAccepted' : IDL.Text,
    'InsufficientFunds' : IDL.Text,
  });
  const SwapResult = IDL.Variant({ 'Ok' : SwapOk, 'Err' : ExchangeError });
  const SplitLeg = IDL.Record({
    'amountIn' : IDL.Nat,
    'route' : IDL.Vec(SwapHop),
    'minLegOut' : IDL.Nat,
  });
  return IDL.Service({
    'getExpectedReceiveAmountBatchMultiOptimal' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Nat],
        [OptimalSwapPlan],
        ['query'],
      ),
    'getV2AllowedTokens' : IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
    'getV2Enabled' : IDL.Func([], [IDL.Bool], ['query']),
    'netToGrossV2' : IDL.Func([IDL.Text, IDL.Nat], [IDL.Nat], ['query']),
    'requiredAllowanceV2' : IDL.Func([IDL.Text, IDL.Nat], [IDL.Nat], ['query']),
    'swapMultiHopV2' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Nat, IDL.Vec(SwapHop), IDL.Nat],
        [SwapResult],
        [],
      ),
    'swapSplitRoutesV2' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Vec(SplitLeg), IDL.Nat],
        [SwapResult],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
