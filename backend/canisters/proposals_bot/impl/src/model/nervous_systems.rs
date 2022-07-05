use crate::NervousSystemMetrics;
use group_canister::update_proposals::ProposalUpdate;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::{BTreeMap, HashMap};
use types::{CanisterId, ChatId, MessageId, Milliseconds, Proposal, ProposalId, TimestampMillis};
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
            .filter(|n| {
                n.proposals_to_be_pushed.queue.is_empty()
                    && !n.proposals_to_be_pushed.in_progress
                    && n.latest_sync().unwrap_or_default() < latest_sync_filter
            })
            .min_by_key(|n| n.latest_sync())
            .map(|n| {
                self.sync_in_progress = Some(n.governance_canister_id);
                n.governance_canister_id
            })
    }

    pub fn dequeue_next_proposal(&mut self) -> Option<ProposalToPush> {
        for ns in self
            .nervous_systems
            .values_mut()
            .filter(|n| !n.proposals_to_be_pushed.in_progress)
        {
            // TODO replace this with `pop_first` once it is stablized
            if let Some(p) = ns
                .proposals_to_be_pushed
                .queue
                .keys()
                .next()
                .cloned()
                .and_then(|k| ns.proposals_to_be_pushed.queue.remove(&k))
            {
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

    pub fn process_proposals(&mut self, governance_canister_id: &CanisterId, proposals: Vec<Proposal>) {
        if let Some(n) = self.nervous_systems.get_mut(governance_canister_id) {
            for proposal in proposals {
                n.process_proposal(proposal);
            }
        }
    }

    pub fn mark_sync_complete(&mut self, governance_canister_id: &CanisterId, success: bool, now: TimestampMillis) {
        self.sync_in_progress = None;

        if let Some(n) = self.nervous_systems.get_mut(governance_canister_id) {
            if success {
                n.latest_successful_sync = Some(now);
            } else {
                n.latest_failed_sync = Some(now);
            }
        }
    }

    pub fn mark_proposal_pushed(&mut self, governance_canister_id: &CanisterId, proposal: Proposal, message_id: MessageId) {
        if let Some(n) = self.nervous_systems.get_mut(governance_canister_id) {
            n.proposals_to_be_pushed.in_progress = false;
            n.active_proposals.insert(proposal.id(), (proposal, message_id));
        }
    }

    pub fn mark_proposal_push_failed(&mut self, governance_canister_id: &CanisterId, proposal: Proposal) {
        if let Some(n) = self.nervous_systems.get_mut(governance_canister_id) {
            n.proposals_to_be_pushed.in_progress = false;
            n.proposals_to_be_pushed.queue.insert(proposal.id(), proposal);
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
struct NervousSystem {
    pub name: String,
    pub governance_canister_id: CanisterId,
    pub chat_id: ChatId,
    pub latest_successful_sync: Option<TimestampMillis>,
    pub latest_failed_sync: Option<TimestampMillis>,
    pub proposals_to_be_pushed: ProposalsToBePushed,
    pub proposals_to_be_updated: ProposalsToBeUpdated,
    pub active_proposals: BTreeMap<ProposalId, (Proposal, MessageId)>,
}

#[derive(Serialize, Deserialize, Debug, Default)]
struct ProposalsToBePushed {
    pub queue: BTreeMap<ProposalId, Proposal>,
    pub in_progress: bool,
}

#[derive(Serialize, Deserialize, Debug, Default)]
struct ProposalsToBeUpdated {
    pub pending: Vec<ProposalUpdate>,
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
            proposals_to_be_pushed: ProposalsToBePushed::default(),
            proposals_to_be_updated: ProposalsToBeUpdated::default(),
            active_proposals: BTreeMap::default(),
        }
    }

    pub fn process_proposal(&mut self, proposal: Proposal) {
        if let Some((previous, message_id)) = self.active_proposals.get_mut(&proposal.id()) {
            let status = proposal.status();
            let reward_status = proposal.reward_status();
            let latest_tally = proposal.tally();

            let update = ProposalUpdate {
                message_id: *message_id,
                status: (status != previous.status()).then(|| status),
                reward_status: (reward_status != previous.reward_status()).then(|| reward_status),
                latest_tally: (latest_tally != previous.tally()).then(|| latest_tally),
            };

            self.proposals_to_be_updated.pending.push(update);
        } else {
            self.proposals_to_be_pushed.queue.insert(proposal.id(), proposal);
        }
    }

    pub fn latest_sync(&self) -> Option<TimestampMillis> {
        max(self.latest_successful_sync, self.latest_failed_sync)
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
