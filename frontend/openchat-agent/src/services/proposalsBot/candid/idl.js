export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const StakeNeuronForSubmittingProposalsArgs = IDL.Record({
    'stake' : IDL.Nat,
    'governance_canister_id' : CanisterId,
  });
  const SnsNeuronId = IDL.Vec(IDL.Nat8);
  const StakeNeuronForSubmittingProposalsResponse = IDL.Variant({
    'NeuronAlreadyExists' : SnsNeuronId,
    'TransferError' : IDL.Text,
    'Success' : SnsNeuronId,
    'Unauthorized' : IDL.Null,
    'GovernanceCanisterNotSupported' : IDL.Null,
    'InternalError' : IDL.Text,
    'StakeTooLow' : IDL.Null,
  });
  const TopUpNeuronArgs = IDL.Record({
    'governance_canister_id' : CanisterId,
    'amount' : IDL.Nat,
  });
  const TopUpNeuronResponse = IDL.Variant({
    'TransferError' : IDL.Text,
    'Success' : IDL.Null,
    'Unauthorized' : IDL.Null,
    'GovernanceCanisterNotSupported' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  return IDL.Service({
    'stake_neuron_for_submitting_proposals' : IDL.Func(
        [StakeNeuronForSubmittingProposalsArgs],
        [StakeNeuronForSubmittingProposalsResponse],
        [],
      ),
    'top_up_neuron' : IDL.Func([TopUpNeuronArgs], [TopUpNeuronResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
