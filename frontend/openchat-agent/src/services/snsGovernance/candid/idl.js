export const idlFactory = ({ IDL }) => {
  const GenericNervousSystemFunction = IDL.Record({
    'validator_canister_id' : IDL.Opt(IDL.Principal),
    'target_canister_id' : IDL.Opt(IDL.Principal),
    'validator_method_name' : IDL.Opt(IDL.Text),
    'target_method_name' : IDL.Opt(IDL.Text),
  });
  const FunctionType = IDL.Variant({
    'NativeNervousSystemFunction' : IDL.Record({}),
    'GenericNervousSystemFunction' : GenericNervousSystemFunction,
  });
  const NervousSystemFunction = IDL.Record({
    'id' : IDL.Nat64,
    'name' : IDL.Text,
    'description' : IDL.Opt(IDL.Text),
    'function_type' : IDL.Opt(FunctionType),
  });
  const ListNervousSystemFunctionsResponse = IDL.Record({
    'reserved_ids' : IDL.Vec(IDL.Nat64),
    'functions' : IDL.Vec(NervousSystemFunction),
  });
  const ProposalId = IDL.Record({ 'id' : IDL.Nat64 });
  const ListProposals = IDL.Record({
    'include_reward_status' : IDL.Vec(IDL.Int32),
    'before_proposal' : IDL.Opt(ProposalId),
    'limit' : IDL.Nat32,
    'exclude_type' : IDL.Vec(IDL.Nat64),
    'include_status' : IDL.Vec(IDL.Int32),
  });
  const Tally = IDL.Record({
    'no' : IDL.Nat64,
    'yes' : IDL.Nat64,
    'total' : IDL.Nat64,
    'timestamp_seconds' : IDL.Nat64,
  });
  const ProposalData = IDL.Record({
    'id' : IDL.Opt(ProposalId),
    'latest_tally' : IDL.Opt(Tally),
  });
  const ListProposalsResponse = IDL.Record({
    'proposals' : IDL.Vec(ProposalData),
  });
  return IDL.Service({
    'list_nervous_system_functions' : IDL.Func(
        [],
        [ListNervousSystemFunctionsResponse],
        ['query'],
      ),
    'list_proposals' : IDL.Func(
        [ListProposals],
        [ListProposalsResponse],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
