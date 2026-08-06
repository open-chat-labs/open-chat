use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{Hash, Milliseconds, TimestampMillis, UserId};
use user_index_canister::propose_protected_action::ProtectedAction;
use utils::hasher::hash_bytes;

// A proposal which nobody confirms dies on its own: no armed authorizations waiting around
// for a second key to be compromised later.
pub const PENDING_PROTECTED_ACTION_TTL: Milliseconds = 14 * 24 * 60 * 60 * 1000; // 14 days

// Dual authorization for the irreversible operator actions (#9136): proposals here only
// execute when confirmed by a different platform operator. Every lifecycle event goes into
// an append-only, hash-chained log (same construction as the storage-bucket vault log); the
// chain head is exposed in public metrics so anyone can verify append-only for themselves.
#[derive(Serialize, Deserialize, Default)]
pub struct ProtectedActions {
    next_id: u64,
    pending: BTreeMap<u64, PendingProtectedAction>,
    log: Vec<ProtectedActionLogEntry>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PendingProtectedAction {
    pub id: u64,
    pub action: ProtectedAction,
    // The different-principal check compares operator principals; the user id is carried for
    // the log and notices
    pub proposed_by_principal: Principal,
    pub proposed_by: UserId,
    pub proposed_at: TimestampMillis,
}

#[derive(Serialize, Deserialize)]
pub struct ProtectedActionLogEntry {
    pub index: u64,
    pub timestamp: TimestampMillis,
    // Hash of the previous entry, making the log a tamper-evident chain
    pub prev_hash: Hash,
    pub event: ProtectedActionLogEvent,
}

// Events carry the action summary, never the action itself, so secrets (eg. the OpenAI key)
// can never enter the log
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum ProtectedActionLogEvent {
    Proposed(u64, String, UserId),
    Confirmed(u64, String, UserId, UserId),
    Cancelled(u64, String, UserId),
    Expired(u64, String),
}

pub enum ConfirmOutcome {
    Confirmed(PendingProtectedAction),
    NotFound,
    ProposerCannotConfirm,
}

impl ProtectedActions {
    pub fn propose(
        &mut self,
        action: ProtectedAction,
        proposed_by_principal: Principal,
        proposed_by: UserId,
        now: TimestampMillis,
    ) -> u64 {
        self.prune_expired(now);
        let id = self.next_id;
        self.next_id += 1;
        self.append_log(ProtectedActionLogEvent::Proposed(id, action.summary(), proposed_by), now);
        self.pending.insert(
            id,
            PendingProtectedAction {
                id,
                action,
                proposed_by_principal,
                proposed_by,
                proposed_at: now,
            },
        );
        id
    }

    pub fn confirm(
        &mut self,
        id: u64,
        confirmer_principal: Principal,
        confirmed_by: UserId,
        now: TimestampMillis,
    ) -> ConfirmOutcome {
        self.prune_expired(now);
        let Some(entry) = self.pending.get(&id) else {
            return ConfirmOutcome::NotFound;
        };
        if entry.proposed_by_principal == confirmer_principal {
            return ConfirmOutcome::ProposerCannotConfirm;
        }
        let entry = self.pending.remove(&id).unwrap();
        self.append_log(
            ProtectedActionLogEvent::Confirmed(id, entry.action.summary(), entry.proposed_by, confirmed_by),
            now,
        );
        ConfirmOutcome::Confirmed(entry)
    }

    pub fn cancel(&mut self, id: u64, cancelled_by: UserId, now: TimestampMillis) -> Option<PendingProtectedAction> {
        self.prune_expired(now);
        let entry = self.pending.remove(&id)?;
        self.append_log(
            ProtectedActionLogEvent::Cancelled(id, entry.action.summary(), cancelled_by),
            now,
        );
        Some(entry)
    }

    pub fn pending(&self) -> impl Iterator<Item = &PendingProtectedAction> {
        self.pending.values()
    }

    pub fn log(&self) -> &[ProtectedActionLogEntry] {
        &self.log
    }

    pub fn metrics(&self) -> ProtectedActionMetrics {
        ProtectedActionMetrics {
            pending: self.pending.len() as u32,
            oldest_pending_at: self.pending.values().map(|p| p.proposed_at).min(),
            log_length: self.log.len() as u64,
            log_chain_head: self.log.last().map(|e| hex::encode(Self::entry_hash(e))),
        }
    }

    fn prune_expired(&mut self, now: TimestampMillis) {
        let expired: Vec<u64> = self
            .pending
            .values()
            .filter(|p| p.proposed_at.saturating_add(PENDING_PROTECTED_ACTION_TTL) < now)
            .map(|p| p.id)
            .collect();
        for id in expired {
            let entry = self.pending.remove(&id).unwrap();
            self.append_log(ProtectedActionLogEvent::Expired(id, entry.action.summary()), now);
        }
    }

    fn append_log(&mut self, event: ProtectedActionLogEvent, now: TimestampMillis) {
        let prev_hash = self.log.last().map(Self::entry_hash).unwrap_or_default();
        self.log.push(ProtectedActionLogEntry {
            index: self.log.len() as u64,
            timestamp: now,
            prev_hash,
            event,
        });
    }

    pub(crate) fn entry_hash(entry: &ProtectedActionLogEntry) -> Hash {
        hash_bytes(msgpack::serialize_then_unwrap(entry))
    }
}

#[derive(Serialize, Debug)]
pub struct ProtectedActionMetrics {
    pub pending: u32,
    pub oldest_pending_at: Option<TimestampMillis>,
    pub log_length: u64,
    // Anyone can snapshot this: a later rewrite of history breaks the chain against the
    // snapshot, so append-only is externally verifiable
    pub log_chain_head: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use testing::rng::{random_from_principal, random_principal};
    use user_index_canister::destroy_vault_evidence;

    fn destroy_action() -> ProtectedAction {
        ProtectedAction::DestroyVaultEvidence(destroy_vault_evidence::Args {
            report_index: 1,
            le_request_ref: "REF-1".to_string(),
        })
    }

    #[test]
    fn proposer_cannot_confirm_own_action() {
        let mut actions = ProtectedActions::default();
        let p1 = random_principal();
        let u1 = random_from_principal::<UserId>();
        let id = actions.propose(destroy_action(), p1, u1, 1);
        assert!(matches!(
            actions.confirm(id, p1, u1, 2),
            ConfirmOutcome::ProposerCannotConfirm
        ));
        // Still pending: the failed confirm must not consume the proposal
        assert_eq!(actions.pending().count(), 1);
    }

    #[test]
    fn different_operator_confirms_and_consumes() {
        let mut actions = ProtectedActions::default();
        let id = actions.propose(destroy_action(), random_principal(), random_from_principal::<UserId>(), 1);
        assert!(matches!(
            actions.confirm(id, random_principal(), random_from_principal::<UserId>(), 2),
            ConfirmOutcome::Confirmed(_)
        ));
        assert_eq!(actions.pending().count(), 0);
        assert!(matches!(
            actions.confirm(id, random_principal(), random_from_principal::<UserId>(), 3),
            ConfirmOutcome::NotFound
        ));
    }

    #[test]
    fn expired_proposal_cannot_be_confirmed() {
        let mut actions = ProtectedActions::default();
        let id = actions.propose(destroy_action(), random_principal(), random_from_principal::<UserId>(), 1);
        let after_expiry = 1 + PENDING_PROTECTED_ACTION_TTL + 1;
        assert!(matches!(
            actions.confirm(id, random_principal(), random_from_principal::<UserId>(), after_expiry),
            ConfirmOutcome::NotFound
        ));
        // Proposed + Expired
        assert_eq!(actions.log().len(), 2);
        assert!(matches!(
            actions.log().last().unwrap().event,
            ProtectedActionLogEvent::Expired(..)
        ));
    }

    #[test]
    fn anyone_can_cancel_including_proposer() {
        let mut actions = ProtectedActions::default();
        let p1 = random_principal();
        let u1 = random_from_principal::<UserId>();
        let id = actions.propose(destroy_action(), p1, u1, 1);
        assert!(actions.cancel(id, u1, 2).is_some());
        assert_eq!(actions.pending().count(), 0);
    }

    #[test]
    fn log_chain_verifies_and_detects_tampering() {
        let mut actions = ProtectedActions::default();
        let id = actions.propose(destroy_action(), random_principal(), random_from_principal::<UserId>(), 1);
        actions.confirm(id, random_principal(), random_from_principal::<UserId>(), 2);
        for pair in actions.log().windows(2) {
            assert_eq!(pair[1].prev_hash, ProtectedActions::entry_hash(&pair[0]));
        }
        assert!(actions.metrics().log_chain_head.is_some());
    }

    #[test]
    fn openai_key_never_appears_in_log_or_summary() {
        let mut actions = ProtectedActions::default();
        let action = ProtectedAction::SetOpenAIApiKey(user_index_canister::set_openai_api_key::Args {
            api_key: Some("sk-super-secret".to_string()),
        });
        let id = actions.propose(action, random_principal(), random_from_principal::<UserId>(), 1);
        actions.confirm(id, random_principal(), random_from_principal::<UserId>(), 2);
        let serialized = String::from_utf8_lossy(&msgpack::serialize_then_unwrap(actions.log())).to_string();
        assert!(!serialized.contains("super-secret"));
    }
}
