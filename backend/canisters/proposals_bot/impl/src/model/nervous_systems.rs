use crate::{generate_message_id, NervousSystemMetrics};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{BTreeMap, HashMap};
use std::mem;
use types::{
    icrc1, CanisterId, MessageId, MessageIndex, Milliseconds, MultiUserChat, Proposal, ProposalDecisionStatus, ProposalId,
    ProposalRewardStatus, ProposalUpdate, SnsNeuronId, TimestampMillis, UserId,
};

#[derive(Serialize, Deserialize, Default)]
pub struct NervousSystems {
    nervous_systems: HashMap<CanisterId, NervousSystem>,
}

impl NervousSystems {
    pub fn add(&mut self, nervous_system: registry_canister::NervousSystemDetails, chat_id: MultiUserChat) {
        self.nervous_systems.insert(
            nervous_system.governance_canister_id,
            NervousSystem::new(nervous_system, chat_id),
        );
    }

    pub fn update_from_registry(&mut self, from_registry: registry_canister::NervousSystemDetails) {
        if let Some(ns) = self.nervous_systems.get_mut(&from_registry.governance_canister_id) {
            ns.ledger_canister_id = from_registry.ledger_canister_id;
            ns.transaction_fee = from_registry.transaction_fee;
            ns.min_neuron_stake = from_registry.min_neuron_stake;
            ns.min_dissolve_delay_to_vote = from_registry.min_dissolve_delay_to_vote;
            ns.proposal_rejection_fee = from_registry.proposal_rejection_fee;
        }
    }

    pub fn mark_neuron_dissolve_delay_increased(
        &mut self,
        governance_canister_id: &CanisterId,
        dissolve_delay_increase: Milliseconds,
    ) {
        if let Some(ns) = self.nervous_systems.get_mut(governance_canister_id) {
            ns.neuron_for_submitting_proposals_dissolve_delay += dissolve_delay_increase;
        }
    }

    pub fn get(&self, governance_canister_id: &CanisterId) -> Option<&NervousSystem> {
        self.nervous_systems.get(governance_canister_id)
    }

    pub fn get_chat_id(&self, governance_canister_id: &CanisterId) -> Option<MultiUserChat> {
        self.get(governance_canister_id).map(|ns| ns.chat_id)
    }

    pub fn get_neuron_id_for_submitting_proposals(&self, governance_canister_id: &CanisterId) -> Option<SnsNeuronId> {
        self.get(governance_canister_id)
            .and_then(|ns| ns.neuron_id_for_submitting_proposals)
    }

    pub fn mark_disabled(&mut self, governance_canister_id: &CanisterId) {
        if let Some(ns) = self.nervous_systems.get_mut(governance_canister_id) {
            ns.disabled = true;
        }
    }

    pub fn validate_submit_proposal_payment(
        &self,
        governance_canister_id: &CanisterId,
        payment: &icrc1::CompletedCryptoTransaction,
    ) -> Result<SnsNeuronId, ValidateSubmitProposalPaymentError> {
        use ValidateSubmitProposalPaymentError::*;
        if let Some(ns) = self.nervous_systems.get(governance_canister_id) {
            if let Some(neuron_id) = ns.neuron_id_for_submitting_proposals {
                return if payment.ledger != ns.ledger_canister_id {
                    Err(IncorrectLedger)
                } else if u64::try_from(payment.amount).unwrap() < ns.proposal_rejection_fee {
                    Err(InsufficientPayment(ns.proposal_rejection_fee + ns.transaction_fee))
                } else {
                    Ok(neuron_id)
                };
            }
        }
        Err(GovernanceCanisterNotSupported)
    }

    pub fn set_neuron_id_for_submitting_proposals(
        &mut self,
        governance_canister_id: &CanisterId,
        neuron_id: SnsNeuronId,
        dissolve_delay: Milliseconds,
    ) -> bool {
        if let Some(ns) = self.nervous_systems.get_mut(governance_canister_id) {
            ns.neuron_id_for_submitting_proposals = Some(neuron_id);
            ns.neuron_for_submitting_proposals_dissolve_delay = dissolve_delay;
            true
        } else {
            false
        }
    }

    pub fn exists(&self, governance_canister_id: &CanisterId) -> bool {
        self.nervous_systems.contains_key(governance_canister_id)
    }

    pub fn start_next_sync(&mut self) -> Vec<CanisterId> {
        self.nervous_systems
            .values_mut()
            .filter(|ns| {
                !ns.disabled
                    && ns.proposals_to_be_pushed.queue.is_empty()
                    && !ns.proposals_to_be_pushed.in_progress
                    && !ns.sync_in_progress
            })
            .map(|ns| {
                ns.sync_in_progress = true;
                ns.governance_canister_id
            })
            .collect()
    }

    pub fn any_proposals_to_push(&self) -> bool {
        self.nervous_systems
            .values()
            .any(|ns| !ns.proposals_to_be_pushed.queue.is_empty())
    }

    pub fn dequeue_next_proposal_to_push(&mut self) -> Option<ProposalToPush> {
        for ns in self
            .nervous_systems
            .values_mut()
            .filter(|n| !n.proposals_to_be_pushed.in_progress)
        {
            if let Some((_, p)) = ns.proposals_to_be_pushed.queue.pop_first() {
                ns.proposals_to_be_pushed.in_progress = true;
                return Some(ProposalToPush {
                    governance_canister_id: ns.governance_canister_id,
                    chat_id: ns.chat_id,
                    proposal: p,
                });
            }
        }
        None
    }

    pub fn get_neuron_in_need_of_dissolve_delay_increase(&self) -> Option<NeuronInNeedOfDissolveDelayIncrease> {
        for ns in self.nervous_systems.values() {
            if let Some(neuron_id) = ns.neuron_id_for_submitting_proposals {
                if let Some(additional_dissolve_delay_seconds) = ns
                    .min_dissolve_delay_to_vote
                    .checked_sub(ns.neuron_for_submitting_proposals_dissolve_delay)
                    .filter(|dd| *dd > 0)
                    .map(|dd| ((dd / 1000) + 1) as u32)
                {
                    return Some(NeuronInNeedOfDissolveDelayIncrease {
                        governance_canister_id: ns.governance_canister_id,
                        neuron_id,
                        additional_dissolve_delay_seconds,
                    });
                }
            }
        }
        None
    }

    pub fn any_proposals_to_update(&self) -> bool {
        self.nervous_systems
            .values()
            .any(|ns| !ns.proposals_to_be_updated.pending.is_empty())
    }

    pub fn dequeue_next_proposals_to_update(&mut self) -> Option<ProposalsToUpdate> {
        self.nervous_systems
            .values_mut()
            .find(|ns| !ns.proposals_to_be_updated.pending.is_empty() && !ns.proposals_to_be_updated.in_progress)
            .map(|ns| {
                ns.proposals_to_be_updated.in_progress = true;
                let proposals = std::mem::take(&mut ns.proposals_to_be_updated.pending)
                    .into_values()
                    .collect();

                ProposalsToUpdate {
                    governance_canister_id: ns.governance_canister_id,
                    chat_id: ns.chat_id,
                    proposals,
                }
            })
    }

    // Proposals which have not been seen before get queued up to be sent as new messages.
    // Proposals which have already been sent as messages get queued up to have those messages
    // updated.
    // Proposals which are now inactive are queued up to have their messages updated to show that
    // they are in the 'settled' state.
    pub fn process_proposals(
        &mut self,
        governance_canister_id: &CanisterId,
        active_proposals: Vec<Proposal>,
        inactive_proposals: Vec<ProposalId>,
    ) {
        if let Some(ns) = self.nervous_systems.get_mut(governance_canister_id) {
            for proposal in inactive_proposals {
                ns.mark_proposal_inactive(proposal);
            }

            for proposal in active_proposals {
                ns.process_proposal(proposal, false);
            }
        }
    }

    pub fn process_finished_proposal(&mut self, governance_canister_id: &CanisterId, proposal: Proposal) {
        if let Some(ns) = self.nervous_systems.get_mut(governance_canister_id) {
            ns.process_proposal(proposal, true);
        }
    }

    pub fn take_newly_decided_user_submitted_proposals(
        &mut self,
        governance_canister_id: CanisterId,
    ) -> Vec<UserSubmittedProposalResult> {
        if let Some(ns) = self
            .nervous_systems
            .get_mut(&governance_canister_id)
            .filter(|ns| !ns.decided_user_submitted_proposals.is_empty())
        {
            mem::take(&mut ns.decided_user_submitted_proposals)
        } else {
            Vec::new()
        }
    }

    pub fn active_proposals(&self, governance_canister_id: &CanisterId) -> Vec<ProposalId> {
        self.nervous_systems
            .get(governance_canister_id)
            .map_or(vec![], |ns| ns.active_proposals.keys().copied().collect())
    }

    pub fn mark_sync_complete(&mut self, governance_canister_id: &CanisterId, success: bool, now: TimestampMillis) {
        if let Some(ns) = self.nervous_systems.get_mut(governance_canister_id) {
            if success {
                ns.latest_successful_sync = Some(now);
            } else {
                ns.latest_failed_sync = Some(now);
            }
            ns.sync_in_progress = false;
        }
    }

    pub fn mark_proposal_pushed(
        &mut self,
        governance_canister_id: &CanisterId,
        proposal: Proposal,
        message_id: MessageId,
        message_index_if_known: Option<MessageIndex>,
    ) {
        if let Some(ns) = self.nervous_systems.get_mut(governance_canister_id) {
            let proposal_id = proposal.id();
            ns.active_proposals.insert(proposal_id, (proposal, message_id));
            ns.proposals_to_be_pushed.in_progress = false;

            if let Some(message_index) = message_index_if_known {
                ns.proposal_messages.insert(proposal_id, (message_index, message_id));
            }
        }
    }

    pub fn mark_proposal_push_failed(&mut self, governance_canister_id: &CanisterId, proposal: Proposal) {
        if let Some(ns) = self.nervous_systems.get_mut(governance_canister_id) {
            ns.proposals_to_be_pushed.queue.insert(proposal.id(), proposal);
            ns.proposals_to_be_pushed.in_progress = false;
        }
    }

    pub fn mark_proposals_updated(&mut self, governance_canister_id: &CanisterId, now: TimestampMillis) {
        if let Some(ns) = self.nervous_systems.get_mut(governance_canister_id) {
            ns.proposals_to_be_updated.in_progress = false;
            ns.latest_successful_proposals_update = Some(now);
        }
    }

    pub fn mark_proposals_update_failed(
        &mut self,
        governance_canister_id: &CanisterId,
        updates: Vec<ProposalUpdate>,
        now: TimestampMillis,
    ) {
        if let Some(ns) = self.nervous_systems.get_mut(governance_canister_id) {
            for update in updates {
                ns.proposals_to_be_updated.pending.entry(update.message_id).or_insert(update);
            }
            ns.proposals_to_be_updated.in_progress = false;
            ns.latest_failed_proposals_update = Some(now);
        }
    }

    pub fn update_chat_id(&mut self, governance_canister_id: CanisterId, chat_id: MultiUserChat) {
        if let Some(ns) = self.nervous_systems.get_mut(&governance_canister_id) {
            ns.chat_id = chat_id;
        }
    }

    pub fn record_user_submitted_proposal(
        &mut self,
        governance_canister_id: CanisterId,
        user_id: UserId,
        proposal_id: ProposalId,
    ) {
        if let Some(ns) = self.nervous_systems.get_mut(&governance_canister_id) {
            ns.active_user_submitted_proposals.insert(proposal_id, user_id);
        }
    }

    pub fn metrics(&self) -> Vec<NervousSystemMetrics> {
        self.nervous_systems
            .values()
            .sorted_unstable_by_key(|ns| ns.governance_canister_id)
            .map_into()
            .collect()
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NervousSystem {
    governance_canister_id: CanisterId,
    ledger_canister_id: CanisterId,
    chat_id: MultiUserChat,
    latest_successful_sync: Option<TimestampMillis>,
    latest_failed_sync: Option<TimestampMillis>,
    latest_successful_proposals_update: Option<TimestampMillis>,
    latest_failed_proposals_update: Option<TimestampMillis>,
    proposals_to_be_pushed: ProposalsToBePushed,
    proposals_to_be_updated: ProposalsToBeUpdated,
    active_proposals: BTreeMap<ProposalId, (Proposal, MessageId)>,
    neuron_id_for_submitting_proposals: Option<SnsNeuronId>,
    neuron_for_submitting_proposals_dissolve_delay: Milliseconds,
    sync_in_progress: bool,
    active_user_submitted_proposals: BTreeMap<ProposalId, UserId>,
    decided_user_submitted_proposals: Vec<UserSubmittedProposalResult>,
    transaction_fee: u64,
    min_neuron_stake: u64,
    min_dissolve_delay_to_vote: Milliseconds,
    proposal_rejection_fee: u64,
    proposal_messages: BTreeMap<ProposalId, (MessageIndex, MessageId)>,
    #[serde(default)]
    disabled: bool,
}

#[derive(Serialize, Deserialize, Debug, Default)]
struct ProposalsToBePushed {
    pub queue: BTreeMap<ProposalId, Proposal>,
    pub in_progress: bool,
}

#[derive(Serialize, Deserialize, Debug, Default)]
struct ProposalsToBeUpdated {
    pub pending: HashMap<MessageId, ProposalUpdate>,
    pub in_progress: bool,
}

impl NervousSystem {
    pub fn new(nervous_system: registry_canister::NervousSystemDetails, chat_id: MultiUserChat) -> NervousSystem {
        NervousSystem {
            governance_canister_id: nervous_system.governance_canister_id,
            ledger_canister_id: nervous_system.ledger_canister_id,
            chat_id,
            latest_successful_sync: None,
            latest_failed_sync: None,
            latest_successful_proposals_update: None,
            latest_failed_proposals_update: None,
            proposals_to_be_pushed: ProposalsToBePushed::default(),
            proposals_to_be_updated: ProposalsToBeUpdated::default(),
            active_proposals: BTreeMap::default(),
            neuron_id_for_submitting_proposals: None,
            neuron_for_submitting_proposals_dissolve_delay: 0,
            sync_in_progress: false,
            active_user_submitted_proposals: BTreeMap::default(),
            decided_user_submitted_proposals: Vec::new(),
            transaction_fee: nervous_system.transaction_fee,
            min_neuron_stake: nervous_system.min_neuron_stake,
            min_dissolve_delay_to_vote: nervous_system.min_dissolve_delay_to_vote,
            proposal_rejection_fee: nervous_system.proposal_rejection_fee,
            proposal_messages: BTreeMap::new(),
            disabled: false,
        }
    }

    pub fn chat_id(&self) -> MultiUserChat {
        self.chat_id
    }

    pub fn process_proposal(&mut self, proposal: Proposal, finished: bool) {
        let proposal_id = proposal.id();

        if let Some(user_id) = self.active_user_submitted_proposals.get(&proposal_id).copied() {
            if let Some(adopted) = match proposal.status() {
                ProposalDecisionStatus::Unspecified | ProposalDecisionStatus::Open => None,
                ProposalDecisionStatus::Adopted | ProposalDecisionStatus::Executed | ProposalDecisionStatus::Failed => {
                    Some(true)
                }
                ProposalDecisionStatus::Rejected => Some(false),
            } {
                self.active_user_submitted_proposals.remove(&proposal_id);
                self.decided_user_submitted_proposals.push(UserSubmittedProposalResult {
                    proposal_id,
                    user_id,
                    adopted,
                });
            }
        }

        if finished {
            let update = ProposalUpdate {
                message_id: generate_message_id(self.governance_canister_id, proposal_id),
                status: Some(proposal.status()),
                reward_status: Some(proposal.reward_status()),
                latest_tally: Some(proposal.tally()),
                deadline: Some(proposal.deadline()),
            };
            self.upsert_proposal_update(update);
        } else if let Some((previous, message_id)) = self.active_proposals.get_mut(&proposal_id) {
            let status = proposal.status();
            let reward_status = proposal.reward_status();
            let latest_tally = proposal.tally();
            let deadline = proposal.deadline();

            let update = ProposalUpdate {
                message_id: *message_id,
                status: (status != previous.status()).then_some(status),
                reward_status: (reward_status != previous.reward_status()).then_some(reward_status),
                latest_tally: (latest_tally != previous.tally()).then_some(latest_tally),
                deadline: (deadline != previous.deadline()).then_some(deadline),
            };
            self.upsert_proposal_update(update);
        } else {
            self.proposals_to_be_pushed.queue.insert(proposal_id, proposal);
        }
    }

    pub fn mark_proposal_inactive(&mut self, proposal_id: ProposalId) {
        if let Some((_, message_id)) = self.active_proposals.remove(&proposal_id) {
            self.upsert_proposal_update(ProposalUpdate {
                message_id,
                status: None,
                reward_status: Some(ProposalRewardStatus::Settled),
                latest_tally: None,
                deadline: None,
            })
        }
    }

    pub fn latest_sync(&self) -> Option<TimestampMillis> {
        max(self.latest_successful_sync, self.latest_failed_sync)
    }

    fn upsert_proposal_update(&mut self, update: ProposalUpdate) {
        match self.proposals_to_be_updated.pending.entry(update.message_id) {
            Occupied(mut e) => {
                let current = e.get_mut();
                if let Some(s) = update.status {
                    current.status = Some(s);
                }
                if let Some(s) = update.reward_status {
                    current.reward_status = Some(s);
                }
                if let Some(t) = update.latest_tally {
                    current.latest_tally = Some(t);
                }
                if let Some(d) = update.deadline {
                    current.deadline = Some(d);
                }
            }
            Vacant(e) => {
                e.insert(update);
            }
        };
    }

    pub fn ledger_canister_id(&self) -> CanisterId {
        self.ledger_canister_id
    }

    pub fn min_dissolve_delay_to_vote(&self) -> Milliseconds {
        self.min_dissolve_delay_to_vote
    }

    pub fn transaction_fee(&self) -> u64 {
        self.transaction_fee
    }

    pub fn proposal_rejection_fee(&self) -> u64 {
        self.proposal_rejection_fee
    }

    pub fn neuron_for_submitting_proposals(&self) -> Option<SnsNeuronId> {
        self.neuron_id_for_submitting_proposals
    }

    pub fn proposal_message(&self, proposal_id: &ProposalId) -> Option<(MessageIndex, MessageId)> {
        self.proposal_messages.get(proposal_id).copied()
    }
}

impl From<&NervousSystem> for NervousSystemMetrics {
    fn from(ns: &NervousSystem) -> Self {
        NervousSystemMetrics {
            governance_canister_id: ns.governance_canister_id,
            ledger_canister_id: ns.ledger_canister_id,
            chat_id: ns.chat_id,
            latest_successful_sync: ns.latest_successful_sync,
            latest_failed_sync: ns.latest_failed_sync,
            latest_successful_proposals_update: ns.latest_successful_proposals_update,
            latest_failed_proposals_update: ns.latest_failed_proposals_update,
            queued_proposals: ns.proposals_to_be_pushed.queue.keys().copied().collect(),
            active_proposals: ns.active_proposals.keys().copied().collect(),
            active_user_submitted_proposals: ns.active_user_submitted_proposals.keys().copied().collect(),
            neuron_for_submitting_proposals: ns.neuron_id_for_submitting_proposals.map(hex::encode),
            neuron_for_submitting_proposals_dissolve_delay: ns.neuron_for_submitting_proposals_dissolve_delay,
            transaction_fee: ns.transaction_fee,
            min_neuron_stake: ns.min_neuron_stake,
            min_dissolve_delay_to_vote: ns.min_dissolve_delay_to_vote,
            proposal_rejection_fee: ns.proposal_rejection_fee,
            disabled: ns.disabled,
        }
    }
}

pub struct ProposalToPush {
    pub governance_canister_id: CanisterId,
    pub chat_id: MultiUserChat,
    pub proposal: Proposal,
}

pub struct ProposalsToUpdate {
    pub governance_canister_id: CanisterId,
    pub chat_id: MultiUserChat,
    pub proposals: Vec<ProposalUpdate>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UserSubmittedProposalResult {
    pub proposal_id: ProposalId,
    pub user_id: UserId,
    pub adopted: bool,
}

pub enum ValidateSubmitProposalPaymentError {
    GovernanceCanisterNotSupported,
    IncorrectLedger,
    InsufficientPayment(u64),
}

pub struct NeuronInNeedOfDissolveDelayIncrease {
    pub governance_canister_id: CanisterId,
    pub neuron_id: SnsNeuronId,
    pub additional_dissolve_delay_seconds: u32,
}
