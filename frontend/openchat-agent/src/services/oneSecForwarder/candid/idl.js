export const idlFactory = ({ IDL }) => {
  const IcrcAccount = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const IcpAccount = IDL.Variant({
    'ICRC' : IcrcAccount,
    'AccountId' : IDL.Text,
  });
  const EnableForwardingArgs = IDL.Record({ 'icp_account' : IcpAccount });
  const IsForwardingAddressArgs = IDL.Record({ 'evm_address' : IDL.Text });
  return IDL.Service({
    'enable_forwarding' : IDL.Func([EnableForwardingArgs], [IDL.Text], []),
    'is_forwarding_address' : IDL.Func(
        [IsForwardingAddressArgs],
        [IDL.Bool],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
