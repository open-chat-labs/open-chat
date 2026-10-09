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
  const UnusedBalanceResult = IDL.Variant({
    'ok' : IDL.Record({ 'balance0' : IDL.Nat, 'balance1' : IDL.Nat }),
    'err' : Error,
  });
  const SwapArgs = IDL.Record({
    'amountIn' : IDL.Text,
    'zeroForOne' : IDL.Bool,
    'amountOutMinimum' : IDL.Text,
  });
  const WithdrawArgs = IDL.Record({
    'fee' : IDL.Nat,
    'token' : IDL.Text,
    'amount' : IDL.Nat,
  });
  return IDL.Service({
    'depositFromAndSwap' : IDL.Func([DepositAndSwapArgs], [NatResult], []),
    'getUserUnusedBalance' : IDL.Func(
        [IDL.Principal],
        [UnusedBalanceResult],
        ['query'],
      ),
    'quoteForAll' : IDL.Func([SwapArgs], [NatResult], ['query']),
    'withdraw' : IDL.Func([WithdrawArgs], [NatResult], []),
  });
};
export const init = ({ IDL }) => { return []; };
