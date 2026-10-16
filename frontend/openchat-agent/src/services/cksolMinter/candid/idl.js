export const idlFactory = ({ IDL }) => {
  const Lamport = IDL.Nat64;
  const MinterInfo = IDL.Record({
    'withdrawal_fee' : Lamport,
    'minimum_deposit_amount' : Lamport,
    'minimum_withdrawal_amount' : Lamport,
  });
  const Address = IDL.Text;
  const WithdrawSolArgs = IDL.Record({
    'from_subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'address' : Address,
    'amount' : Lamport,
  });
  const LedgerBurnIndex = IDL.Nat64;
  const WithdrawSolOk = IDL.Record({ 'block_index' : LedgerBurnIndex });
  const WithdrawSolError = IDL.Variant({
    'MalformedAddress' : Address,
    'ValueTooSmall' : IDL.Record({
      'withdrawal_amount' : Lamport,
      'minimum_withdrawal_amount' : Lamport,
    }),
    'TemporarilyUnavailable' : IDL.Text,
    'InvalidDestination' : IDL.Text,
    'InsufficientAllowance' : IDL.Record({ 'allowance' : Lamport }),
    'AlreadyProcessing' : IDL.Null,
    'InsufficientFunds' : IDL.Record({ 'balance' : Lamport }),
  });
  const WithdrawSolResult = IDL.Variant({
    'Ok' : WithdrawSolOk,
    'Err' : WithdrawSolError,
  });
  return IDL.Service({
    'get_minter_info' : IDL.Func([], [MinterInfo], ['query']),
    'withdraw_sol' : IDL.Func([WithdrawSolArgs], [WithdrawSolResult], []),
  });
};
export const init = ({ IDL }) => { return []; };
