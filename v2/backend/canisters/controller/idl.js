export default ({ IDL }) => {
  const IndexCanister = IDL.Variant({
    'UserIndex' : IDL.Null,
    'PhoneIndex' : IDL.Null,
    'GroupIndex' : IDL.Null,
  });
  const InstallIndexArgs = IDL.Record({
    'wasm' : IDL.Vec(IDL.Nat8),
    'version' : IDL.Text,
    'canister_type' : IndexCanister,
  });
  const CanisterId = IDL.Principal;
  const InstallIndexResponse = IDL.Variant({
    'Success' : CanisterId,
    'Failure' : IDL.Null,
  });
  const InstallWebsiteArgs = IDL.Record({
    'wasm' : IDL.Vec(IDL.Nat8),
    'version' : IDL.Text,
    'canister_type' : IndexCanister,
  });
  const InstallWebsiteResponse = IDL.Variant({
    'Success' : CanisterId,
    'Failure' : IDL.Null,
  });
  const MetricsArgs = IDL.Record({});
  const MetricsResponse = IDL.Record({
    'cycles_balance' : IDL.Int64,
    'caller_id' : IDL.Principal,
    'bytes_used' : IDL.Nat64,
    'timestamp' : IDL.Nat64,
    'wasm_memory_used' : IDL.Nat64,
  });
  const NotifyBalanceArgs = IDL.Record({ 'balance' : IDL.Nat });
  const BackendCanister = IDL.Variant({
    'UserIndex' : IDL.Null,
    'PhoneIndex' : IDL.Null,
    'GroupIndex' : IDL.Null,
    'Group' : IDL.Null,
    'User' : IDL.Null,
  });
  const UpgradeArgs = IDL.Record({
    'wasm' : IDL.Vec(IDL.Nat8),
    'version' : IDL.Text,
    'canister_type' : BackendCanister,
  });
  const UpgradeResponse = IDL.Variant({
    'Success' : IDL.Record({ 'canister_id' : CanisterId }),
    'Failure' : IDL.Null,
  });
  return IDL.Service({
    'install_index' : IDL.Func([InstallIndexArgs], [InstallIndexResponse], []),
    'install_website' : IDL.Func(
        [InstallWebsiteArgs],
        [InstallWebsiteResponse],
        [],
      ),
    'metrics' : IDL.Func([MetricsArgs], [MetricsResponse], ['query']),
    'notify_balance' : IDL.Func([NotifyBalanceArgs], [], []),
    'upgrade' : IDL.Func([UpgradeArgs], [UpgradeResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
