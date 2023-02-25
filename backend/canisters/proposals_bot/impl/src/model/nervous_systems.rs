use crate::NervousSystemMetrics;
use group_canister::c2c_update_proposals::ProposalUpdate;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{BTreeMap, HashMap};
use types::{CanisterId, ChatId, MessageId, Milliseconds, Proposal, ProposalId, ProposalRewardStatus, TimestampMillis};
use utils::time::MINUTE_IN_MS;

const MIN_INTERVAL_BETWEEN_SYNCS: Milliseconds = MINUTE_IN_MS; // 1 minute

#[derive(Serialize, Deserialize, Default)]
pub struct NervousSystems {
    nervous_systems: HashMap<CanisterId, NervousSystem>,
    sync_in_progress: Option<CanisterId>,
}

impl NervousSystems {
    pub fn add(&mut self, name: String, governance_canister_id: CanisterId, chat_id: ChatId) {
        self.nervous_systems.insert(
            governance_canister_id,
            NervousSystem::new(name, governance_canister_id, chat_id),
        );
    }

    pub fn get(&self, governance_canister_id: &CanisterId) -> Option<&NervousSystem> {
        self.nervous_systems.get(governance_canister_id)
    }

    pub fn get_chat_id(&self, governance_canister_id: &CanisterId) -> Option<ChatId> {
        self.nervous_systems.get(governance_canister_id).map(|ns| ns.chat_id)
    }

    pub fn remove(&mut self, governance_canister_id: &CanisterId) -> bool {
        self.nervous_systems.remove(governance_canister_id).is_some()
    }

    pub fn exists(&self, governance_canister_id: &CanisterId) -> bool {
        self.nervous_systems.contains_key(governance_canister_id)
    }

    pub fn start_next_sync(&mut self, now: TimestampMillis) -> Option<CanisterId> {
        if self.sync_in_progress.is_some() {
            return None;
        }

        let latest_sync_filter = now.saturating_sub(MIN_INTERVAL_BETWEEN_SYNCS);

        self.nervous_systems
            .values()
            .filter(|ns| {
                ns.proposals_to_be_pushed.queue.is_empty()
                    && !ns.proposals_to_be_pushed.in_progress
                    && ns.latest_sync().unwrap_or_default() < latest_sync_filter
            })
            .min_by_key(|ns| ns.latest_sync())
            .map(|ns| {
                self.sync_in_progress = Some(ns.governance_canister_id);
                ns.governance_canister_id
            })
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
                ns.process_proposal(proposal);
            }
        }
    }

    pub fn active_proposals(&self, governance_canister_id: &CanisterId) -> Vec<ProposalId> {
        self.nervous_systems
            .get(governance_canister_id)
            .map_or(vec![], |ns| ns.active_proposals.keys().copied().collect())
    }

    pub fn mark_sync_complete(&mut self, governance_canister_id: &CanisterId, success: bool, now: TimestampMillis) {
        self.sync_in_progress = None;

        if let Some(ns) = self.nervous_systems.get_mut(governance_canister_id) {
            if success {
                ns.latest_successful_sync = Some(now);
            } else {
                ns.latest_failed_sync = Some(now);
            }
        }
    }

    pub fn mark_proposal_pushed(&mut self, governance_canister_id: &CanisterId, proposal: Proposal, message_id: MessageId) {
        if let Some(ns) = self.nervous_systems.get_mut(governance_canister_id) {
            ns.active_proposals.insert(proposal.id(), (proposal, message_id));
            ns.proposals_to_be_pushed.in_progress = false;
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

    pub fn metrics(&self) -> Vec<NervousSystemMetrics> {
        self.nervous_systems
            .values()
            .sorted_unstable_by_key(|ns| ns.name.as_str())
            .map_into()
            .collect()
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NervousSystem {
    name: String,
    governance_canister_id: CanisterId,
    chat_id: ChatId,
    latest_successful_sync: Option<TimestampMillis>,
    latest_failed_sync: Option<TimestampMillis>,
    latest_successful_proposals_update: Option<TimestampMillis>,
    latest_failed_proposals_update: Option<TimestampMillis>,
    proposals_to_be_pushed: ProposalsToBePushed,
    proposals_to_be_updated: ProposalsToBeUpdated,
    pub active_proposals: BTreeMap<ProposalId, (Proposal, MessageId)>,
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
    pub fn new(name: String, governance_canister_id: CanisterId, chat_id: ChatId) -> NervousSystem {
        NervousSystem {
            name,
            governance_canister_id,
            chat_id,
            latest_successful_sync: None,
            latest_failed_sync: None,
            latest_successful_proposals_update: None,
            latest_failed_proposals_update: None,
            proposals_to_be_pushed: ProposalsToBePushed::default(),
            proposals_to_be_updated: ProposalsToBeUpdated::default(),
            active_proposals: BTreeMap::default(),
        }
    }

    pub fn process_proposal(&mut self, proposal: Proposal) {
        let proposal_id = proposal.id();

        if let Some((previous, message_id)) = self.active_proposals.get_mut(&proposal_id) {
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
            }
            Vacant(e) => {
                e.insert(update);
            }
        };
    }
}

impl From<&NervousSystem> for NervousSystemMetrics {
    fn from(ns: &NervousSystem) -> Self {
        NervousSystemMetrics {
            name: ns.name.clone(),
            governance_canister_id: ns.governance_canister_id,
            chat_id: ns.chat_id,
            latest_successful_sync: ns.latest_successful_sync,
            latest_failed_sync: ns.latest_failed_sync,
            latest_successful_proposals_update: ns.latest_successful_proposals_update,
            latest_failed_proposals_update: ns.latest_failed_proposals_update,
            queued_proposals: ns.proposals_to_be_pushed.queue.keys().copied().collect(),
            active_proposals: ns.active_proposals.keys().copied().collect(),
        }
    }
}

pub struct ProposalToPush {
    pub governance_canister_id: CanisterId,
    pub chat_id: ChatId,
    pub proposal: Proposal,
}

pub struct ProposalsToUpdate {
    pub governance_canister_id: CanisterId,
    pub chat_id: ChatId,
    pub proposals: Vec<ProposalUpdate>,
}
