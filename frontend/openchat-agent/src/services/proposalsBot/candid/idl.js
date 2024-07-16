export const idlFactory = ({ IDL }) => {
  const ProposalId = IDL.Nat64;
  const CanisterId = IDL.Principal;
  const LookupProposalMessageArgs = IDL.Record({
    'proposal_id' : ProposalId,
    'governance_canister_id' : CanisterId,
  });
  const ChatId = CanisterId;
  const CommunityId = CanisterId;
  const ChannelId = IDL.Nat;
  const MultiUserChat = IDL.Variant({
    'Group' : ChatId,
    'Channel' : IDL.Tuple(CommunityId, ChannelId),
  });
  const MessageId = IDL.Nat;
  const MessageIndex = IDL.Nat32;
  const LookupProposalMessageResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Record({
      'chat_id' : MultiUserChat,
      'message_id' : MessageId,
      'message_index' : MessageIndex,
    }),
  });
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
    'lookup_proposal_message' : IDL.Func(
        [LookupProposalMessageArgs],
        [LookupProposalMessageResponse],
        ['query'],
      ),
    'stake_neuron_for_submitting_proposals' : IDL.Func(
        [StakeNeuronForSubmittingProposalsArgs],
        [StakeNeuronForSubmittingProposalsResponse],
        [],
      ),
    'top_up_neuron' : IDL.Func([TopUpNeuronArgs], [TopUpNeuronResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
