use crate::RuntimeState;
use candid::Principal;
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{Hash, Milliseconds, OCResult, TimestampMillis, UserId};
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
    // Confirmation is rejected if EITHER matches the confirmer: the principal covers the
    // stolen-key case, the user id covers the same operator returning under a new principal
    pub proposed_by_principal: Principal,
    pub proposed_by: UserId,
    pub proposed_at: TimestampMillis,
}

// The chain hash is taken over this struct's serialization, and the chain head is published
// so it can be verified externally. Adding or removing a FIELD here changes the hash of every
// historical entry and breaks verification against any previously published head - append new
// variants to ProtectedActionLogEvent instead, which is hash-stable.
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
    // A pending proposal was replaced by a newer one of the same kind
    Superseded(u64, String, u64, UserId),
}

pub enum ConfirmOutcome {
    Confirmed(PendingProtectedAction),
    NotFound,
    ProposerCannotConfirm,
}

impl ProtectedActions {
    // Returns the action id, and whether an identical action was ALREADY pending (in which
    // case nothing new is queued and the existing proposal is returned). Comparison is over
    // the encoded action rather than its summary: summaries redact secrets, so two different
    // API keys share a summary and must never collapse into one proposal.
    pub fn propose(
        &mut self,
        action: ProtectedAction,
        proposed_by_principal: Principal,
        proposed_by: UserId,
        now: TimestampMillis,
    ) -> (u64, bool) {
        self.prune_expired(now);

        let encoded = msgpack::serialize_then_unwrap(&action);
        if let Some(existing) = self
            .pending
            .values()
            .find(|p| msgpack::serialize_then_unwrap(&p.action) == encoded)
        {
            // Identical to what is already pending (typically a double click). Deliberately
            // returns the original even when the proposer differs: the second operator still
            // has to press Confirm, which is the separate deliberate act dual authorization
            // requires, and the log records both identities
            return (existing.id, true);
        }

        let id = self.next_id;

        // A different payload of the same kind supersedes the pending one, so the list always
        // shows the current intent. The replacement takes a NEW id, so an operator confirming
        // from a stale screen gets a clean failure rather than silently confirming a payload
        // which was swapped underneath them. The supersession is logged either way.
        let superseded: Vec<u64> = self
            .pending
            .values()
            .filter(|p| p.action.kind() == action.kind())
            .map(|p| p.id)
            .collect();
        for old_id in superseded {
            let entry = self.pending.remove(&old_id).unwrap();
            self.append_log(
                ProtectedActionLogEvent::Superseded(old_id, entry.action.summary(), id, proposed_by),
                now,
            );
        }

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
        (id, false)
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
        if entry.proposed_by_principal == confirmer_principal || entry.proposed_by == confirmed_by {
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

    pub fn get(&self, id: u64) -> Option<&PendingProtectedAction> {
        self.pending.get(&id)
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

// Validation for the dual-authorized actions, run BOTH when an action is proposed (so the
// proposer finds out immediately) and again when it is confirmed (state can change while a
// proposal sits pending - a report can be resolved, a moderator removed, a hold applied).
// Keeping it in one place is what stops the two checks drifting apart.
//
// `actor` is the operator proposing or confirming. Dual authorization is a two-person rule,
// which is not the same as a conflict-of-interest rule: it stops one key acting alone, but
// says nothing about whether the operator is the SUBJECT of the report they are acting on.
// Running this check on both sides means neither the proposer nor the confirmer can be the
// party whose own evidence is being destroyed or unheld.
pub(crate) fn validate(action: &ProtectedAction, actor: UserId, state: &RuntimeState) -> OCResult {
    match action {
        ProtectedAction::DestroyVaultEvidence(args) => {
            if args.le_request_ref.trim().is_empty() {
                return Err(OCErrorCode::InvalidRequest.with_message("A law enforcement request reference is required"));
            }
            let report = state
                .data
                .reported_messages
                .get(args.report_index)
                .ok_or(OCErrorCode::MessageNotFound)?;
            if report.sender == actor {
                return Err(OCErrorCode::InitiatorNotAuthorized
                    .with_message("Cannot destroy the evidence for a report against your own message"));
            }
            if report.blob_references.is_empty() {
                return Err(OCErrorCode::InvalidRequest.with_message("The report holds no vaulted evidence"));
            }
            // Checked across ALL reports sharing these blobs, not just this one: the bucket's
            // hold is per blob record, so a hold placed via a sibling report also blocks this
            // destruction there - refusing here stops the confirm alert reporting a
            // destruction the bucket will refuse
            let held = state
                .data
                .reported_messages
                .reports_with_hold_intersecting(&report.blob_references);
            if let Some(holder) = held.first() {
                return Err(OCErrorCode::InvalidRequest.with_message(format!(
                    "A legal hold (via report #{holder}) stands on this evidence - clear the hold before destroying it"
                )));
            }
        }
        ProtectedAction::SetVaultLegalHold(args) => {
            if args.reference.trim().is_empty() {
                return Err(OCErrorCode::InvalidRequest.with_message("A reference for the request is required"));
            }
            let report = state
                .data
                .reported_messages
                .get(args.report_index)
                .ok_or(OCErrorCode::MessageNotFound)?;
            if report.sender == actor {
                return Err(OCErrorCode::InitiatorNotAuthorized
                    .with_message("Cannot change the legal hold on a report against your own message"));
            }
            if report.blob_references.is_empty() {
                return Err(OCErrorCode::InvalidRequest.with_message("The report holds no vaulted evidence"));
            }
        }
        ProtectedAction::SetVaultReviewers(args) => {
            // Checked here as well as at execution so a proposal which can never succeed is
            // never queued in the first place
            if let Some(user_id) = args.user_ids.iter().find(|u| !state.data.platform_moderators.contains(u)) {
                return Err(OCErrorCode::InvalidRequest.with_message(format!("{user_id} is not a platform moderator")));
            }
        }
        ProtectedAction::SetOpenAIApiKey(args) => {
            // Unsetting is `None`; an empty or blank string is a mistake, not an instruction
            if args.api_key.as_ref().is_some_and(|k| k.trim().is_empty()) {
                return Err(OCErrorCode::InvalidRequest
                    .with_message("The API key is blank - to switch detection off, propose unsetting it instead"));
            }
        }
        ProtectedAction::SetInternalModerationChannel(args) => {
            if let Some(channel) = &args.channel {
                // The community's existence cannot be checked from here (the user_index knows
                // nothing about communities), so this catches only structurally impossible
                // ids. Whether the channel exists is verified by the alert failing to post,
                // which is why the proposal shows the ids for the confirmer to check.
                if Principal::from(channel.community_id) == Principal::anonymous() {
                    return Err(OCErrorCode::InvalidRequest.with_message("That is not a valid community id"));
                }
            }
        }
    }

    Ok(())
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
        let (id, _) = actions.propose(destroy_action(), p1, u1, 1);
        assert!(matches!(
            actions.confirm(id, p1, u1, 2),
            ConfirmOutcome::ProposerCannotConfirm
        ));
        // Still pending: the failed confirm must not consume the proposal
        assert_eq!(actions.pending().count(), 1);
    }

    #[test]
    fn same_operator_cannot_confirm_under_a_new_principal() {
        let mut actions = ProtectedActions::default();
        let operator = random_from_principal::<UserId>();
        let (id, _) = actions.propose(destroy_action(), random_principal(), operator, 1);
        // Different principal, same human: still the proposer
        assert!(matches!(
            actions.confirm(id, random_principal(), operator, 2),
            ConfirmOutcome::ProposerCannotConfirm
        ));
        assert_eq!(actions.pending().count(), 1);
    }

    #[test]
    fn different_operator_confirms_and_consumes() {
        let mut actions = ProtectedActions::default();
        let (id, _) = actions.propose(destroy_action(), random_principal(), random_from_principal::<UserId>(), 1);
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
        let (id, _) = actions.propose(destroy_action(), random_principal(), random_from_principal::<UserId>(), 1);
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
        let (id, _) = actions.propose(destroy_action(), p1, u1, 1);
        assert!(actions.cancel(id, u1, 2).is_some());
        assert_eq!(actions.pending().count(), 0);
    }

    #[test]
    fn identical_pending_action_collapses_into_the_existing_proposal() {
        let mut actions = ProtectedActions::default();
        let p1 = random_principal();
        let u1 = random_from_principal::<UserId>();
        let (first, existed) = actions.propose(destroy_action(), p1, u1, 1);
        assert!(!existed);

        // Same proposer, and a different operator, both collapse onto the original
        let (again, existed) = actions.propose(destroy_action(), p1, u1, 2);
        assert!(existed);
        assert_eq!(again, first);
        let (from_other, existed) = actions.propose(destroy_action(), random_principal(), random_from_principal::<UserId>(), 3);
        assert!(existed);
        assert_eq!(from_other, first);

        assert_eq!(actions.pending().count(), 1);
        // Only the original proposal was logged
        assert_eq!(actions.log().len(), 1);
    }

    #[test]
    fn a_new_payload_of_the_same_kind_supersedes_the_pending_one() {
        let mut actions = ProtectedActions::default();
        let key = |k: &str| {
            ProtectedAction::SetOpenAIApiKey(user_index_canister::set_openai_api_key::Args {
                api_key: Some(k.to_string()),
            })
        };
        let proposer = random_principal();
        let (first, _) = actions.propose(key("key-one"), proposer, random_from_principal::<UserId>(), 1);
        let (second, existed) = actions.propose(key("key-two"), proposer, random_from_principal::<UserId>(), 2);

        assert!(!existed);
        assert_ne!(first, second);
        // Only the newer proposal survives, and it carries a new id
        assert_eq!(actions.pending().count(), 1);
        assert_eq!(actions.pending().next().unwrap().id, second);
        // Confirming the superseded id fails rather than applying the swapped payload
        assert!(matches!(
            actions.confirm(first, random_principal(), random_from_principal::<UserId>(), 3),
            ConfirmOutcome::NotFound
        ));
        // The supersession is logged (before the replacement's own Proposed entry)
        assert!(
            actions
                .log()
                .iter()
                .any(|e| matches!(e.event, ProtectedActionLogEvent::Superseded(..)))
        );
    }

    #[test]
    fn actions_of_different_kinds_can_be_pending_together() {
        let mut actions = ProtectedActions::default();
        actions.propose(destroy_action(), random_principal(), random_from_principal::<UserId>(), 1);
        actions.propose(
            ProtectedAction::SetOpenAIApiKey(user_index_canister::set_openai_api_key::Args { api_key: None }),
            random_principal(),
            random_from_principal::<UserId>(),
            2,
        );
        assert_eq!(actions.pending().count(), 2);
    }

    #[test]
    fn actions_differing_only_in_a_redacted_secret_do_not_collapse() {
        let mut actions = ProtectedActions::default();
        let key = |k: &str| {
            ProtectedAction::SetOpenAIApiKey(user_index_canister::set_openai_api_key::Args {
                api_key: Some(k.to_string()),
            })
        };
        // Both summarise as "SetOpenAIApiKey(<redacted>)", so a summary-based comparison
        // would treat them as the same proposal and apply the wrong key. They must be seen as
        // distinct: the second supersedes the first rather than collapsing into it
        let (first, _) = actions.propose(key("key-one"), random_principal(), random_from_principal::<UserId>(), 1);
        let (second, existed) = actions.propose(key("key-two"), random_principal(), random_from_principal::<UserId>(), 2);
        assert!(!existed);
        assert_ne!(first, second);
        assert_eq!(actions.pending().next().unwrap().id, second);
    }

    #[test]
    fn log_chain_verifies_and_detects_tampering() {
        let mut actions = ProtectedActions::default();
        let (id, _) = actions.propose(destroy_action(), random_principal(), random_from_principal::<UserId>(), 1);
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
        let (id, _) = actions.propose(action, random_principal(), random_from_principal::<UserId>(), 1);
        actions.confirm(id, random_principal(), random_from_principal::<UserId>(), 2);
        let serialized = String::from_utf8_lossy(&msgpack::serialize_then_unwrap(actions.log())).to_string();
        assert!(!serialized.contains("super-secret"));
    }
}
