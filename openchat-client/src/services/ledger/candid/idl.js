export const idlFactory = ({ IDL }) => {
  const AccountIdentifier = IDL.Vec(IDL.Nat8);
  const AccountBalanceArgs = IDL.Record({ 'account' : AccountIdentifier });
  const Tokens = IDL.Record({ 'e8s' : IDL.Nat64 });
  return IDL.Service({
    'account_balance' : IDL.Func([AccountBalanceArgs], [Tokens], ['query'])
  });
};
export const init = ({ IDL }) => { return []; };
