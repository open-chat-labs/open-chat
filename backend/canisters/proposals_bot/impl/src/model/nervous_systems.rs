use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::{HashMap, VecDeque};
use types::{CanisterId, ChatId, Milliseconds, Proposal, ProposalId, TimestampMillis};
use utils::time::MINUTE_IN_MS;

const MIN_INTERVAL_BETWEEN_SYNCS: Milliseconds = MINUTE_IN_MS; // 1 minute

#[derive(Serialize, Deserialize, Default)]
pub struct NervousSystems {
    nervous_systems: HashMap<CanisterId, NervousSystem>,
    sync_in_progress: Option<CanisterId>,
}

impl NervousSystems {
    pub fn add(&mut self, name: String, governance_canister_id: CanisterId, chat_id: ChatId, next_proposal_id: ProposalId) {
        self.nervous_systems.insert(
            governance_canister_id,
            NervousSystem::new(name, governance_canister_id, chat_id, next_proposal_id),
        );
    }

    pub fn exists(&self, governance_canister_id: &CanisterId) -> bool {
        self.nervous_systems.contains_key(governance_canister_id)
    }

    pub fn start_next_sync(&mut self, now: TimestampMillis) -> Option<(CanisterId, ProposalId)> {
        if self.sync_in_progress.is_some() {
            return None;
        }

        let latest_sync_filter = now.saturating_sub(MIN_INTERVAL_BETWEEN_SYNCS);

        self.nervous_systems
            .values()
            .filter(|n| {
                n.queued_proposals.is_empty()
                    && n.in_progress_proposal.is_none()
                    && n.latest_sync().unwrap_or_default() < latest_sync_filter
            })
            .min_by_key(|n| n.latest_sync())
            .map(|n| {
                self.sync_in_progress = Some(n.governance_canister_id);
                (n.governance_canister_id, n.next_proposal_id)
            })
    }

    pub fn dequeue_next_proposal(&mut self) -> Option<ProposalToPush> {
        for ns in self.nervous_systems.values_mut().filter(|n| n.in_progress_proposal.is_none()) {
            if let Some(p) = ns.queued_proposals.pop_front() {
                ns.in_progress_proposal = Some(p.clone());
                return Some(ProposalToPush {
                    governance_canister_id: ns.governance_canister_id,
                    chat_id: ns.chat_id,
                    proposal: p,
                });
            }
        }
        None
    }

    pub fn enqueue_proposal(&mut self, governance_canister_id: &CanisterId, proposal: Proposal, is_retry: bool) {
        if let Some(n) = self.nervous_systems.get_mut(governance_canister_id) {
            if is_retry {
                n.queued_proposals.push_front(proposal);
            } else {
                n.queued_proposals.push_back(proposal);
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

    pub fn mark_proposal_completed(&mut self, governance_canister_id: &CanisterId) {
        if let Some(n) = self.nervous_systems.get_mut(governance_canister_id) {
            n.in_progress_proposal = None;
        }
    }

    pub fn set_next_proposal_id(&mut self, governance_canister_id: &CanisterId, next_proposal_id: ProposalId) {
        if let Some(n) = self.nervous_systems.get_mut(governance_canister_id) {
            n.next_proposal_id = next_proposal_id;
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
struct NervousSystem {
    pub name: String,
    pub governance_canister_id: CanisterId,
    pub chat_id: ChatId,
    pub next_proposal_id: ProposalId,
    pub latest_successful_sync: Option<TimestampMillis>,
    pub latest_failed_sync: Option<TimestampMillis>,
    pub queued_proposals: VecDeque<Proposal>,
    pub in_progress_proposal: Option<Proposal>,
}

impl NervousSystem {
    pub fn new(
        name: String,
        governance_canister_id: CanisterId,
        chat_id: ChatId,
        next_proposal_id: ProposalId,
    ) -> NervousSystem {
        NervousSystem {
            name,
            governance_canister_id,
            chat_id,
            next_proposal_id,
            latest_successful_sync: None,
            latest_failed_sync: None,
            queued_proposals: VecDeque::new(),
            in_progress_proposal: None,
        }
    }

    pub fn latest_sync(&self) -> Option<TimestampMillis> {
        max(self.latest_successful_sync, self.latest_failed_sync)
    }
}

pub struct ProposalToPush {
    pub governance_canister_id: CanisterId,
    pub chat_id: ChatId,
    pub proposal: Proposal,
}
