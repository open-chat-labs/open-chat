export const idlFactory = ({ IDL }) => {
  const DepositAndSwapArgs = IDL.Record({
    'tokenInFee' : IDL.Nat,
    'amountIn' : IDL.Text,
    'zeroForOne' : IDL.Bool,
    'amountOutMinimum' : IDL.Text,
    'tokenOutFee' : IDL.Nat,
  });
  const Error = IDL.Variant({
    'CommonError' : IDL.Null,
    'InternalError' : IDL.Text,
    'UnsupportedToken' : IDL.Text,
    'InsufficientFunds' : IDL.Null,
  });
  const NatResult = IDL.Variant({ 'ok' : IDL.Nat, 'err' : Error });
  const SwapArgs = IDL.Record({
    'amountIn' : IDL.Text,
    'zeroForOne' : IDL.Bool,
    'amountOutMinimum' : IDL.Text,
  });
  return IDL.Service({
    'depositFromAndSwap' : IDL.Func([DepositAndSwapArgs], [NatResult], []),
    'quoteForAll' : IDL.Func([SwapArgs], [NatResult], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
