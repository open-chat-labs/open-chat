export default ({ IDL }) => {
  const IndexCanister = IDL.Variant({
    'UserIndex' : IDL.Null,
    'PhoneIndex' : IDL.Null,
    'GroupIndex' : IDL.Null,
  });
  const InstallIndexRequest = IDL.Record({
    'wasm' : IDL.Vec(IDL.Nat8),
    'version' : IDL.Text,
    'canister_type' : IndexCanister,
  });
  const CanisterId = IDL.Principal;
  const InstallIndexResponse = IDL.Variant({
    'Success' : CanisterId,
    'Failure' : IDL.Null,
  });
  const InstallWebsiteRequest = IDL.Record({
    'wasm' : IDL.Vec(IDL.Nat8),
    'version' : IDL.Text,
    'canister_type' : IndexCanister,
  });
  const InstallWebsiteResponse = IDL.Variant({
    'Success' : CanisterId,
    'Failure' : IDL.Null,
  });
  const Metrics = IDL.Record({
    'cycles_balance' : IDL.Int64,
    'caller_id' : IDL.Principal,
    'bytes_used' : IDL.Nat64,
    'timestamp' : IDL.Nat64,
    'wasm_memory_used' : IDL.Nat64,
  });
  const BalanceNotification = IDL.Record({ 'balance' : IDL.Nat });
  const BackendCanister = IDL.Variant({
    'UserIndex' : IDL.Null,
    'PhoneIndex' : IDL.Null,
    'GroupIndex' : IDL.Null,
    'Group' : IDL.Null,
    'User' : IDL.Null,
  });
  const UpgradeRequest = IDL.Record({
    'wasm' : IDL.Vec(IDL.Nat8),
    'version' : IDL.Text,
    'canister_type' : BackendCanister,
  });
  const UpgradeResponse = IDL.Variant({
    'Success' : IDL.Record({ 'canister_id' : CanisterId }),
    'Failure' : IDL.Null,
  });
  return IDL.Service({
    'install_index' : IDL.Func(
        [InstallIndexRequest],
        [InstallIndexResponse],
        [],
      ),
    'install_website' : IDL.Func(
        [InstallWebsiteRequest],
        [InstallWebsiteResponse],
        [],
      ),
    'metrics' : IDL.Func([], [Metrics], ['query']),
    'notify_balance' : IDL.Func([BalanceNotification], [], []),
    'upgrade' : IDL.Func([UpgradeRequest], [UpgradeResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
