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
  const QuoteRoute = IDL.Record({
    'expectedBuyAmount' : IDL.Nat,
    'fee' : IDL.Nat,
    'priceImpact' : IDL.Float64,
    'routeDescription' : IDL.Text,
    'canFulfillFully' : IDL.Bool,
    'potentialOrderDetails' : IDL.Opt(PotentialOrderDetails),
    'hopDetails' : IDL.Vec(HopDetail),
    'routeTokens' : IDL.Vec(IDL.Text),
    'tradingFeeBps' : IDL.Nat,
  });
  const RequestResponse = IDL.Record({
    'routes' : IDL.Vec(QuoteRoute),
  });
  const Request = IDL.Record({
    'tokenSell' : IDL.Text,
    'tokenBuy' : IDL.Text,
    'amountSell' : IDL.Nat,
  });
  return IDL.Service({
    'getExpectedReceiveAmountBatchMulti' : IDL.Func(
        [IDL.Vec(Request), IDL.Nat],
        [IDL.Vec(RequestResponse)],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
