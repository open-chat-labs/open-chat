export const idlFactory = ({ IDL }) => {
  const Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  return IDL.Service({
    'icrc1_balance_of' : IDL.Func([Account], [IDL.Nat], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
