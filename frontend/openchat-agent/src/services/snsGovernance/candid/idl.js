export const idlFactory = ({ IDL }) => {
  const ProposalId = IDL.Record({ 'id' : IDL.Nat64 });
  const GetProposal = IDL.Record({ 'proposal_id' : IDL.Opt(ProposalId) });
  const GovernanceError = IDL.Record({
    'error_message' : IDL.Text,
    'error_type' : IDL.Int32,
  });
  const Tally = IDL.Record({
    'no' : IDL.Nat64,
    'yes' : IDL.Nat64,
    'total' : IDL.Nat64,
    'timestamp_seconds' : IDL.Nat64,
  });
  const ProposalDataTrimmed = IDL.Record({ 'latest_tally' : IDL.Opt(Tally) });
  const GetProposalResult = IDL.Variant({
    'Error' : GovernanceError,
    'Proposal' : ProposalDataTrimmed,
  });
  const GetProposalResponse = IDL.Record({
    'result' : IDL.Opt(GetProposalResult),
  });
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
  return IDL.Service({
    'get_proposal' : IDL.Func([GetProposal], [GetProposalResponse], ['query']),
    'list_nervous_system_functions' : IDL.Func(
        [],
        [ListNervousSystemFunctionsResponse],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
