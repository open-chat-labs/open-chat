export const idlFactory = ({ IDL }) => {
  const Lamport = IDL.Nat64;
  const MinterInfo = IDL.Record({
    'deposit_sol_fee' : IDL.Nat,
    'balance' : Lamport,
    'withdrawal_fee' : Lamport,
    'minimum_deposit_amount' : Lamport,
    'deposit_sol_required_cycles' : IDL.Nat,
    'nonce_accounts' : IDL.Vec(IDL.Text),
    'minimum_withdrawal_amount' : Lamport,
    'minter_address' : IDL.Opt(IDL.Text),
  });
  return IDL.Service({
    'get_minter_info' : IDL.Func([], [MinterInfo], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
