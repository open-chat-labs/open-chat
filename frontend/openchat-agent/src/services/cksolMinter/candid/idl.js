export const idlFactory = ({ IDL }) => {
  const Lamport = IDL.Nat64;
  const MinterInfo = IDL.Record({ 'minimum_deposit_amount' : Lamport });
  return IDL.Service({
    'get_minter_info' : IDL.Func([], [MinterInfo], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
