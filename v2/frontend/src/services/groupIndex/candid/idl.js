export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const InitArgs = IDL.Record({
    'test_mode' : IDL.Bool,
    'service_principals' : IDL.Vec(IDL.Principal),
    'notifications_canister_id' : CanisterId,
    'group_wasm_module' : IDL.Vec(IDL.Nat8),
  });
  const SearchArgs = IDL.Record({
    'max_results' : IDL.Nat8,
    'search_term' : IDL.Text,
  });
  const ChatId = CanisterId;
  const GroupMatch = IDL.Record({
    'name' : IDL.Text,
    'description' : IDL.Text,
    'avatar_id' : IDL.Opt(IDL.Nat),
    'chat_id' : ChatId,
  });
  const SearchSuccessResult = IDL.Record({ 'matches' : IDL.Vec(GroupMatch) });
  const SearchResponse = IDL.Variant({
    'TermTooShort' : IDL.Nat8,
    'Success' : SearchSuccessResult,
    'TermTooLong' : IDL.Nat8,
    'InvalidTerm' : IDL.Null,
  });
  const Version = IDL.Record({
    'major' : IDL.Nat32,
    'minor' : IDL.Nat32,
    'patch' : IDL.Nat32,
  });
  const CanisterWasm = IDL.Record({
    'version' : Version,
    'module' : IDL.Vec(IDL.Nat8),
  });
  const UpdateGroupCanisterWasmArgs = IDL.Record({
    'group_canister_wasm' : CanisterWasm,
  });
  const UpdateGroupCanisterWasmResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'VersionNotHigher' : IDL.Null,
    'InvalidVersion' : IDL.Null,
  });
  return IDL.Service({
    'search' : IDL.Func([SearchArgs], [SearchResponse], ['query']),
    'update_group_canister_wasm' : IDL.Func(
        [UpdateGroupCanisterWasmArgs],
        [UpdateGroupCanisterWasmResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const InitArgs = IDL.Record({
    'test_mode' : IDL.Bool,
    'service_principals' : IDL.Vec(IDL.Principal),
    'notifications_canister_id' : CanisterId,
    'group_wasm_module' : IDL.Vec(IDL.Nat8),
  });
  return [InitArgs];
};
