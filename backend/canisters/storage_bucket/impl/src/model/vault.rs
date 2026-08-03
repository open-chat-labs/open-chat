use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use storage_bucket_canister::c2c_vault_sync::VaultCaptureMetadata;
use storage_bucket_canister::c2c_vault_sync::VaultReviewer;
use types::{FileId, Hash, TimestampMillis, UserId};
use utils::hasher::hash_bytes;

// Evidence vault: metadata, retention state and the append-only access log for quarantined
// blobs. The blob bytes themselves stay in `Files`, kept alive by a vault pin on the hash so
// that no existing deletion path can remove them (see Files::vault_pin).
#[derive(Serialize, Deserialize, Default)]
pub struct Vault {
    records: BTreeMap<Hash, VaultRecord>,
    file_id_to_hash: BTreeMap<FileId, Hash>,
    #[serde(default, deserialize_with = "deserialize_reviewers")]
    reviewers: HashMap<Principal, UserId>,
    log: Vec<VaultLogEntry>,
    #[serde(default)]
    quarantine_failures: u64,
    // Hashes whose content received an UpheldAsCsam verdict, kept forever (a resolved report
    // can never be re-resolved, so a CSAM verdict is final): blocks public serving even after
    // the vaulted record is released, and lets a re-upload of the same content be detected
    // and reported. Maps to the report whose verdict denylisted the hash.
    #[serde(default)]
    csam_hashes: BTreeMap<Hash, u64>,
    // (uploader, file id) pairs whose upload/forward was refused because of a denylisted
    // hash: dedupes the report to the user_index, which would otherwise fire once per chunk
    // (chunks upload in parallel and each one is refused) and once per retry of the same
    // attempt. Keyed per uploader so one user's refused forward never silences another's.
    #[serde(default)]
    blocked_attempts: BTreeSet<(Principal, FileId)>,
    // Ephemeral read sessions: (reviewer, file_id) -> next expected chunk. Not serialized:
    // an upgrade resets sessions and reviewers restart from chunk 0 (an extra logged act,
    // never an unlogged one).
    #[serde(skip)]
    sessions: BTreeMap<(Principal, FileId), u32>,
}

#[derive(Serialize, Deserialize)]
#[serde(from = "VaultRecordCompat")]
pub struct VaultRecord {
    pub hash: Hash,
    pub original_file_id: FileId,
    // Captured at quarantine time since the file record may be deleted while the blob is vaulted
    #[serde(default)]
    pub mime_type: String,
    pub metadata: VaultCaptureMetadata,
    pub quarantined_at: TimestampMillis,
    pub retention_until: Option<TimestampMillis>,
    // Tracked separately from retention_until: an honest-unverified filing anchors the
    // retention clock without a verdict, and such a record must still count as unresolved
    pub verdict_applied: bool,
    pub legal_hold: bool,
    // Every report holding this blob as evidence; the record is only released when the last
    // one lets go (see unquarantine)
    pub report_indexes: BTreeSet<u64>,
    // The claims which have received a verdict: expiry must never destroy evidence while a
    // claim still awaits one, and the unresolved metric keys off this rather than a
    // record-level flag which the FIRST verdict would flip
    pub verdicted_report_indexes: BTreeSet<u64>,
    // A release was refused because of a legal hold; clearing the hold performs it
    pub release_pending: bool,
}

// Records serialized before verdict_applied existed only ever had retention_until set by a
// verdict, so infer the flag from it on deserialization
#[derive(Deserialize)]
struct VaultRecordCompat {
    hash: Hash,
    original_file_id: FileId,
    #[serde(default)]
    mime_type: String,
    metadata: VaultCaptureMetadata,
    quarantined_at: TimestampMillis,
    retention_until: Option<TimestampMillis>,
    #[serde(default)]
    verdict_applied: Option<bool>,
    legal_hold: bool,
    #[serde(default)]
    report_indexes: BTreeSet<u64>,
    #[serde(default)]
    verdicted_report_indexes: BTreeSet<u64>,
    #[serde(default)]
    release_pending: bool,
}

impl From<VaultRecordCompat> for VaultRecord {
    fn from(c: VaultRecordCompat) -> Self {
        VaultRecord {
            hash: c.hash,
            original_file_id: c.original_file_id,
            mime_type: c.mime_type,
            metadata: c.metadata,
            quarantined_at: c.quarantined_at,
            verdict_applied: c.verdict_applied.unwrap_or(c.retention_until.is_some()),
            retention_until: c.retention_until,
            legal_hold: c.legal_hold,
            report_indexes: c.report_indexes,
            verdicted_report_indexes: c.verdicted_report_indexes,
            release_pending: c.release_pending,
        }
    }
}

impl VaultRecord {
    // True while any report holding this blob still awaits a verdict. Records predating
    // per-claim tracking fall back to the record-level flag.
    pub fn has_unresolved_claims(&self) -> bool {
        if self.report_indexes.is_empty() || (self.verdict_applied && self.verdicted_report_indexes.is_empty()) {
            return !self.verdict_applied;
        }
        self.report_indexes.iter().any(|i| !self.verdicted_report_indexes.contains(i))
    }
}

#[derive(Serialize, Deserialize)]
pub struct VaultLogEntry {
    pub index: u64,
    pub timestamp: TimestampMillis,
    // Hash of the previous entry, making the log a tamper-evident chain
    pub prev_hash: Hash,
    pub event: VaultLogEvent,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum VaultLogEvent {
    // FileId plus the report_index which triggered the quarantine, so that when multiple
    // reports reference the same blob each report's linkage is preserved in the log even
    // though the vault keeps a single record per hash
    Quarantined(FileId, u64),
    Unquarantined(FileId),
    VerdictApplied(FileId, TimestampMillis),
    LegalHoldSet(FileId),
    LegalHoldCleared(FileId),
    Destroyed(FileId, String),
    RetentionExpired(FileId),
    // Legacy entries from before the reviewer user_id was captured at event time
    Viewed(FileId, Principal),
    ViewedBy(FileId, Principal, Option<UserId>),
    UnquarantinedBy(FileId, Option<UserId>),
    VerdictAppliedBy(FileId, TimestampMillis, Option<UserId>),
    // Retention clock re-anchored (eg. at filing time) without a verdict being recorded
    RetentionReanchoredBy(FileId, TimestampMillis, Option<UserId>),
}

impl VaultLogEvent {
    pub fn file_id(&self) -> FileId {
        match self {
            VaultLogEvent::Quarantined(file_id, _)
            | VaultLogEvent::Unquarantined(file_id)
            | VaultLogEvent::VerdictApplied(file_id, _)
            | VaultLogEvent::LegalHoldSet(file_id)
            | VaultLogEvent::LegalHoldCleared(file_id)
            | VaultLogEvent::Destroyed(file_id, _)
            | VaultLogEvent::RetentionExpired(file_id)
            | VaultLogEvent::Viewed(file_id, _)
            | VaultLogEvent::ViewedBy(file_id, _, _)
            | VaultLogEvent::UnquarantinedBy(file_id, _)
            | VaultLogEvent::VerdictAppliedBy(file_id, _, _)
            | VaultLogEvent::RetentionReanchoredBy(file_id, _, _) => *file_id,
        }
    }
}

pub enum VaultOpOutcome {
    Applied,
    // The blob is no longer referenced by the vault and its pin should be released
    ReleasePin(Hash),
    // The record was kept because other reports still hold the blob as evidence
    Retained,
    // The operation was refused because the record is under legal hold
    Blocked,
    NotFound,
}

impl Vault {
    pub fn set_reviewers(&mut self, reviewers: Vec<VaultReviewer>) {
        self.reviewers = reviewers.into_iter().map(|r| (r.principal, r.user_id)).collect();
    }

    pub fn is_reviewer(&self, principal: &Principal) -> bool {
        self.reviewers.contains_key(principal)
    }

    pub fn record_for_file(&self, file_id: &FileId) -> Option<&VaultRecord> {
        self.file_id_to_hash.get(file_id).and_then(|h| self.records.get(h))
    }

    pub fn quarantine(
        &mut self,
        file_id: FileId,
        hash: Hash,
        mime_type: String,
        metadata: VaultCaptureMetadata,
        now: TimestampMillis,
    ) {
        self.file_id_to_hash.insert(file_id, hash);
        self.append_log(VaultLogEvent::Quarantined(file_id, metadata.report_index), now);

        // If the hash is already quarantined (another file referencing the same blob), the
        // original record is kept; the log entry above preserves this report's linkage
        let report_index = metadata.report_index;
        let record = self.records.entry(hash).or_insert(VaultRecord {
            hash,
            original_file_id: file_id,
            mime_type,
            metadata,
            quarantined_at: now,
            retention_until: None,
            verdict_applied: false,
            legal_hold: false,
            report_indexes: BTreeSet::new(),
            verdicted_report_indexes: BTreeSet::new(),
            release_pending: false,
        });
        record.report_indexes.insert(report_index);
    }

    pub fn record_quarantine_failure(&mut self) {
        self.quarantine_failures += 1;
    }

    pub fn is_csam_hash(&self, hash: &Hash) -> bool {
        self.csam_hashes.contains_key(hash)
    }

    pub fn known_csam_report_index(&self, hash: &Hash) -> Option<u64> {
        self.csam_hashes.get(hash).copied()
    }

    // True the first time this (uploader, file id) pair is blocked: the caller only reports
    // the attempt to the user_index on the first sighting
    pub fn record_blocked_attempt(&mut self, uploader: Principal, file_id: FileId) -> bool {
        self.blocked_attempts.insert((uploader, file_id))
    }

    // One-time backfill for records verdicted before the denylist existed. Idempotent, so
    // safe to run on every upgrade.
    pub fn backfill_csam_hashes(&mut self) {
        let entries: Vec<(Hash, u64)> = self
            .records
            .values()
            .filter(|r| r.verdict_applied)
            .map(|r| {
                let report_index = r.verdicted_report_indexes.first().copied().unwrap_or(r.metadata.report_index);
                (r.hash, report_index)
            })
            .collect();
        for (hash, report_index) in entries {
            self.csam_hashes.entry(hash).or_insert(report_index);
        }
    }

    pub fn unquarantine(
        &mut self,
        file_id: FileId,
        moderator: Option<UserId>,
        report_index: Option<u64>,
        now: TimestampMillis,
    ) -> VaultOpOutcome {
        let Some(hash) = self.file_id_to_hash.get(&file_id).copied() else {
            return VaultOpOutcome::NotFound;
        };
        // One blob can be evidence for several reports (the same content posted in more than
        // one message dedupes to a single hash). A dismissal releases only its own report's
        // claim; the blob is released only when no report holds it any more - otherwise a
        // dismissal of a duplicate would destroy the evidence of a still-open report. A
        // release without a report index (legacy sender) keeps the whole-record semantics.
        // Claim bookkeeping happens even under a legal hold - the sender never re-sends, so a
        // claim dropped here would leak the record forever - but the hold blocks the RELEASE
        // (LE-requested destruction is the only operation which overrides a hold): the
        // release is recorded as pending and performed when the hold is cleared.
        if let Some(record) = self.records.get_mut(&hash) {
            if let Some(report_index) = report_index {
                record.report_indexes.remove(&report_index);
                record.verdicted_report_indexes.remove(&report_index);
                if !record.report_indexes.is_empty() {
                    return VaultOpOutcome::Retained;
                }
            }
            if record.legal_hold {
                record.release_pending = true;
                return VaultOpOutcome::Blocked;
            }
        }
        for alias in self.remove_all_references(&hash) {
            self.append_log(VaultLogEvent::UnquarantinedBy(alias, moderator), now);
        }
        VaultOpOutcome::ReleasePin(hash)
    }

    pub fn apply_verdict(
        &mut self,
        file_id: FileId,
        retention_until: TimestampMillis,
        moderator: Option<UserId>,
        reanchor: bool,
        report_index: Option<u64>,
        now: TimestampMillis,
    ) -> VaultOpOutcome {
        let Some(record) = self.file_id_to_hash.get(&file_id).and_then(|h| self.records.get_mut(h)) else {
            return VaultOpOutcome::NotFound;
        };
        // The clock only ever extends: a re-anchor (or a verdict landing after an
        // honest-unverified filing) must never shorten an already-set retention
        let retention_until = record.retention_until.map_or(retention_until, |r| r.max(retention_until));
        record.retention_until = Some(retention_until);
        if reanchor {
            self.append_log(VaultLogEvent::RetentionReanchoredBy(file_id, retention_until, moderator), now);
        } else {
            record.verdict_applied = true;
            // Resolution is per claim: the first report's verdict must not mark a sibling
            // report's claim resolved (see has_unresolved_claims)
            if let Some(report_index) = report_index {
                record.verdicted_report_indexes.insert(report_index);
            }
            let hash = record.hash;
            let denylist_report_index = report_index.unwrap_or(record.metadata.report_index);
            self.csam_hashes.entry(hash).or_insert(denylist_report_index);
            self.append_log(VaultLogEvent::VerdictAppliedBy(file_id, retention_until, moderator), now);
        }
        VaultOpOutcome::Applied
    }

    pub fn set_legal_hold(&mut self, file_id: FileId, legal_hold: bool, now: TimestampMillis) -> VaultOpOutcome {
        let Some(record) = self.file_id_to_hash.get(&file_id).and_then(|h| self.records.get_mut(h)) else {
            return VaultOpOutcome::NotFound;
        };
        record.legal_hold = legal_hold;
        let hash = record.hash;
        let release = !legal_hold && record.release_pending;
        let event = if legal_hold {
            VaultLogEvent::LegalHoldSet(file_id)
        } else {
            VaultLogEvent::LegalHoldCleared(file_id)
        };
        self.append_log(event, now);
        // A release refused because of the hold is performed now that the hold is cleared
        if release {
            for alias in self.remove_all_references(&hash) {
                self.append_log(VaultLogEvent::UnquarantinedBy(alias, None), now);
            }
            return VaultOpOutcome::ReleasePin(hash);
        }
        VaultOpOutcome::Applied
    }

    // Permanent destruction on law enforcement request, overriding the retention clock and any
    // legal hold. The log entry (including the request reference) survives the record.
    pub fn destroy(&mut self, file_id: FileId, le_request_ref: String, now: TimestampMillis) -> VaultOpOutcome {
        let Some(hash) = self.file_id_to_hash.get(&file_id).copied() else {
            return VaultOpOutcome::NotFound;
        };
        for alias in self.remove_all_references(&hash) {
            self.append_log(VaultLogEvent::Destroyed(alias, le_request_ref.clone()), now);
        }
        VaultOpOutcome::ReleasePin(hash)
    }

    // Authorizes serving a chunk to a reviewer. Chunk 0 always succeeds: it is the deliberate
    // review act, is logged, and (re)opens a sequential read session. Later chunks are served
    // only as the session's next expected chunk, so no bytes can ever be fetched outside a
    // logged session, while the log stays 1:1 with review acts.
    pub fn authorize_view(
        &mut self,
        file_id: FileId,
        reviewer: Principal,
        chunk_index: u32,
        chunk_count: u32,
        now: TimestampMillis,
    ) -> bool {
        let key = (reviewer, file_id);
        if chunk_index == 0 {
            // The user_id is captured at event time: resolving it later through a live
            // mapping would break as reviewers are replaced or accounts deleted
            let user_id = self.reviewers.get(&reviewer).copied();
            self.append_log(VaultLogEvent::ViewedBy(file_id, reviewer, user_id), now);
            if chunk_count > 1 {
                self.sessions.insert(key, 1);
            } else {
                self.sessions.remove(&key);
            }
            true
        } else if self.sessions.get(&key) == Some(&chunk_index) {
            if chunk_index + 1 < chunk_count {
                self.sessions.insert(key, chunk_index + 1);
            } else {
                self.sessions.remove(&key);
            }
            true
        } else {
            false
        }
    }

    pub fn next_retention_expiry(&self) -> Option<TimestampMillis> {
        self.records
            .values()
            .filter(|r| !r.legal_hold)
            .filter_map(|r| r.retention_until)
            .min()
    }

    // Removes expired records, returning the hashes whose pins should be released
    pub fn remove_expired(&mut self, now: TimestampMillis) -> Vec<Hash> {
        let expired: Vec<(FileId, Hash)> = self
            .records
            .values()
            // A claim still awaiting a verdict blocks expiry: one report's retention clock
            // running out must never destroy the evidence of a sibling report that is still
            // open (the unresolved metric keeps such records loudly visible meanwhile)
            .filter(|r| !r.legal_hold && !r.has_unresolved_claims() && r.retention_until.is_some_and(|ts| ts <= now))
            .map(|r| (r.original_file_id, r.hash))
            .collect();

        for (_, hash) in expired.iter() {
            for alias in self.remove_all_references(hash) {
                self.append_log(VaultLogEvent::RetentionExpired(alias), now);
            }
        }

        expired.into_iter().map(|(_, hash)| hash).collect()
    }

    // A single O(n) pass; acceptable while logs are small (a handful of events per report).
    // If growth ever threatens the query instruction limit, add a per-file index.
    pub fn log_page(&self, start: u64, max: u32, file_id: Option<FileId>) -> (u64, Vec<&VaultLogEntry>) {
        let matches = |e: &VaultLogEntry| file_id.is_none_or(|f| e.event.file_id() == f);
        let mut total = 0u64;
        let mut entries = Vec::new();
        for entry in self.log.iter().filter(|e| matches(e)) {
            if total >= start && entries.len() < max as usize {
                entries.push(entry);
            }
            total += 1;
        }
        (total, entries)
    }

    pub fn metrics(&self) -> VaultMetrics {
        // Unresolved means no verdict, not "no retention clock": an honest-unverified filing
        // anchors retention without resolving anything, and unresolved quarantines pin media
        // indefinitely with nothing else watching, so surface the count and the oldest
        VaultMetrics {
            quarantined: self.records.len() as u64,
            legal_holds: self.records.values().filter(|r| r.legal_hold).count() as u64,
            reviewers: self.reviewers.len() as u64,
            log_length: self.log.len() as u64,
            quarantine_failures: self.quarantine_failures,
            csam_hashes: self.csam_hashes.len() as u64,
            unresolved_quarantines: self.records.values().filter(|r| r.has_unresolved_claims()).count() as u64,
            oldest_unresolved_quarantined_at: self
                .records
                .values()
                .filter(|r| r.has_unresolved_claims())
                .map(|r| r.quarantined_at)
                .min(),
        }
    }

    // Removes the record and every file_id alias mapping to the hash, so that quarantine state
    // is released for all sibling files referencing the same blob at once
    fn remove_all_references(&mut self, hash: &Hash) -> Vec<FileId> {
        self.records.remove(hash);
        let aliases: Vec<FileId> = self
            .file_id_to_hash
            .iter()
            .filter(|(_, h)| *h == hash)
            .map(|(id, _)| *id)
            .collect();
        self.file_id_to_hash.retain(|_, h| h != hash);
        self.sessions.retain(|(_, file_id), _| !aliases.contains(file_id));
        aliases
    }

    fn append_log(&mut self, event: VaultLogEvent, now: TimestampMillis) {
        let prev_hash = self.log.last().map(Self::entry_hash).unwrap_or_default();
        self.log.push(VaultLogEntry {
            index: self.log.len() as u64,
            timestamp: now,
            prev_hash,
            event,
        });
    }

    pub(crate) fn entry_hash(entry: &VaultLogEntry) -> Hash {
        hash_bytes(msgpack::serialize_then_unwrap(entry))
    }
}

#[derive(Debug)]
pub struct VaultMetrics {
    pub quarantined: u64,
    pub legal_holds: u64,
    pub reviewers: u64,
    pub log_length: u64,
    pub quarantine_failures: u64,
    pub csam_hashes: u64,
    pub unresolved_quarantines: u64,
    pub oldest_unresolved_quarantined_at: Option<TimestampMillis>,
}

// The reviewer set briefly shipped (to test envs only) as a bare principal set; accept that
// shape on upgrade as an empty map (the set is re-synced whenever the operator applies it).
// Inert everywhere else - production never held the old shape.
fn deserialize_reviewers<'de, D>(d: D) -> Result<HashMap<Principal, UserId>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Compat {
        New(HashMap<Principal, UserId>),
        #[allow(dead_code)]
        Old(HashSet<Principal>),
    }

    Ok(match Compat::deserialize(d)? {
        Compat::New(reviewers) => reviewers,
        Compat::Old(_) => HashMap::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use types::Chat;

    fn metadata(report_index: u64) -> VaultCaptureMetadata {
        VaultCaptureMetadata {
            report_index,
            chat: Chat::Group(Principal::anonymous().into()),
            message_index: 0.into(),
            message_id: 1u64.into(),
            sender: Principal::anonymous().into(),
            detection_timestamp: 1,
            classifier_categories: 2,
        }
    }

    fn reviewer(n: u8) -> Principal {
        Principal::from_slice(&[n; 8])
    }

    fn vault_with_reviewer() -> Vault {
        let mut vault = Vault::default();
        vault.set_reviewers(vec![VaultReviewer {
            principal: reviewer(1),
            user_id: Principal::from_slice(&[9; 8]).into(),
        }]);
        vault
    }

    #[test]
    fn log_is_hash_chained_and_verifiable() {
        let mut vault = vault_with_reviewer();
        vault.quarantine(1, [1u8; 32], "image/png".to_string(), metadata(0), 100);
        assert!(vault.authorize_view(1, reviewer(1), 0, 1, 200));
        vault.apply_verdict(1, 999, Some(Principal::from_slice(&[9; 8]).into()), false, Some(0), 300);

        let (total, entries) = vault.log_page(0, 100, None);
        assert_eq!(total, 3);
        // Each entry's prev_hash is the hash of the previous entry; the first chains from zero
        assert_eq!(entries[0].prev_hash, Hash::default());
        for pair in entries.windows(2) {
            assert_eq!(pair[1].prev_hash, Vault::entry_hash(pair[0]));
        }
        // Tampering with any entry breaks the chain for its successor
        let tampered = VaultLogEntry {
            index: entries[1].index,
            timestamp: entries[1].timestamp + 1,
            prev_hash: entries[1].prev_hash,
            event: entries[1].event.clone(),
        };
        assert_ne!(Vault::entry_hash(&tampered), entries[2].prev_hash);
    }

    #[test]
    fn view_attribution_is_captured_at_event_time() {
        let mut vault = vault_with_reviewer();
        vault.quarantine(1, [1u8; 32], "image/png".to_string(), metadata(0), 100);
        assert!(vault.authorize_view(1, reviewer(1), 0, 1, 200));

        // Replacing the reviewer set afterwards must not change what was recorded
        vault.set_reviewers(Vec::new());
        let (_, entries) = vault.log_page(0, 100, None);
        let user_id = Principal::from_slice(&[9; 8]).into();
        assert!(matches!(&entries[1].event, VaultLogEvent::ViewedBy(1, p, Some(u)) if *p == reviewer(1) && *u == user_id));
    }

    #[test]
    fn chunk_sessions_must_be_ordered() {
        let mut vault = vault_with_reviewer();
        vault.quarantine(1, [1u8; 32], "video/mp4".to_string(), metadata(0), 100);

        // Chunk 0 starts a session; later chunks only in order
        assert!(vault.authorize_view(1, reviewer(1), 0, 3, 200));
        assert!(!vault.authorize_view(1, reviewer(1), 2, 3, 201));
        assert!(vault.authorize_view(1, reviewer(1), 1, 3, 202));
        assert!(vault.authorize_view(1, reviewer(1), 2, 3, 203));
        // Session complete: repeating a later chunk without a new session is refused
        assert!(!vault.authorize_view(1, reviewer(1), 1, 3, 204));
        // Only chunk 0 is a logged act
        let (_, entries) = vault.log_page(0, 100, None);
        assert_eq!(
            entries
                .iter()
                .filter(|e| matches!(e.event, VaultLogEvent::ViewedBy(..)))
                .count(),
            1
        );
    }

    #[test]
    fn legal_hold_blocks_release() {
        let mut vault = vault_with_reviewer();
        vault.quarantine(1, [1u8; 32], "image/png".to_string(), metadata(0), 100);
        vault.set_legal_hold(1, true, 200);
        assert!(matches!(vault.unquarantine(1, None, Some(0), 300), VaultOpOutcome::Blocked));
        assert!(vault.record_for_file(&1).is_some());
        // The refused release is performed when the hold is cleared (the sender never
        // re-sends the unquarantine op)
        assert!(matches!(vault.set_legal_hold(1, false, 400), VaultOpOutcome::ReleasePin(_)));
        assert!(vault.record_for_file(&1).is_none());
    }

    #[test]
    fn shared_hash_release_waits_for_the_last_report() {
        let mut vault = vault_with_reviewer();
        // The same blob (one hash) quarantined via two files, each held by a different report
        vault.quarantine(1, [1u8; 32], "image/png".to_string(), metadata(7), 100);
        vault.quarantine(2, [1u8; 32], "image/png".to_string(), metadata(8), 101);

        // Dismissing report 8 keeps the record: report 7's evidence must survive
        assert!(matches!(vault.unquarantine(2, None, Some(8), 200), VaultOpOutcome::Retained));
        assert!(vault.record_for_file(&1).is_some());
        assert!(matches!(
            vault.apply_verdict(1, 999, None, false, Some(7), 250),
            VaultOpOutcome::Applied
        ));

        // No UnquarantinedBy entry was logged: the blob's custody did not change
        let (_, entries) = vault.log_page(0, 100, None);
        assert!(!entries.iter().any(|e| matches!(e.event, VaultLogEvent::UnquarantinedBy(..))));

        // The last report letting go releases the blob
        assert!(matches!(
            vault.unquarantine(1, None, Some(7), 300),
            VaultOpOutcome::ReleasePin(_)
        ));
        assert!(vault.record_for_file(&1).is_none());
        assert!(vault.record_for_file(&2).is_none());

        // A release with no report index (legacy sender) keeps whole-record semantics
        let mut vault = vault_with_reviewer();
        vault.quarantine(3, [2u8; 32], "image/png".to_string(), metadata(9), 100);
        vault.quarantine(4, [2u8; 32], "image/png".to_string(), metadata(10), 101);
        assert!(matches!(
            vault.unquarantine(3, None, None, 200),
            VaultOpOutcome::ReleasePin(_)
        ));
        assert!(vault.record_for_file(&4).is_none());
    }

    #[test]
    fn log_page_filters_by_file() {
        let mut vault = vault_with_reviewer();
        vault.quarantine(1, [1u8; 32], "image/png".to_string(), metadata(0), 100);
        vault.quarantine(2, [2u8; 32], "image/png".to_string(), metadata(1), 101);
        assert!(vault.authorize_view(2, reviewer(1), 0, 1, 200));

        let (total_all, _) = vault.log_page(0, 100, None);
        assert_eq!(total_all, 3);
        let (total_one, entries) = vault.log_page(0, 100, Some(2));
        assert_eq!(total_one, 2);
        assert!(entries.iter().all(|e| e.event.file_id() == 2));
    }

    #[test]
    fn reanchor_extends_retention_without_resolving() {
        let mut vault = vault_with_reviewer();
        vault.quarantine(1, [1u8; 32], "image/png".to_string(), metadata(0), 100);
        let operator: UserId = Principal::from_slice(&[9; 8]).into();

        // An honest-unverified filing re-anchors retention but the record stays unresolved
        vault.apply_verdict(1, 999, Some(operator), true, Some(0), 300);
        let metrics = vault.metrics();
        assert_eq!(metrics.unresolved_quarantines, 1);
        assert_eq!(metrics.oldest_unresolved_quarantined_at, Some(100));

        // The log shows a re-anchor, not a verdict
        let (_, entries) = vault.log_page(0, 100, None);
        assert!(matches!(&entries[1].event, VaultLogEvent::RetentionReanchoredBy(1, 999, Some(u)) if *u == operator));
        assert!(!entries.iter().any(|e| matches!(e.event, VaultLogEvent::VerdictAppliedBy(..))));

        // The later verdict resolves the record and never shortens the clock
        vault.apply_verdict(1, 500, Some(operator), false, Some(0), 400);
        let metrics = vault.metrics();
        assert_eq!(metrics.unresolved_quarantines, 0);
        assert_eq!(metrics.oldest_unresolved_quarantined_at, None);
        let (_, entries) = vault.log_page(0, 100, None);
        assert!(matches!(&entries[2].event, VaultLogEvent::VerdictAppliedBy(1, 999, Some(u)) if *u == operator));
    }

    #[test]
    fn claim_released_under_legal_hold_defers_the_release_to_hold_clear() {
        let mut vault = vault_with_reviewer();
        vault.quarantine(1, [1u8; 32], "image/png".to_string(), metadata(7), 100);
        vault.quarantine(2, [1u8; 32], "image/png".to_string(), metadata(8), 101);
        vault.set_legal_hold(1, true, 150);

        // Claim bookkeeping proceeds under the hold; only the physical release is blocked
        assert!(matches!(vault.unquarantine(1, None, Some(7), 200), VaultOpOutcome::Retained));
        assert!(matches!(vault.unquarantine(2, None, Some(8), 250), VaultOpOutcome::Blocked));
        assert!(vault.record_for_file(&1).is_some());

        // Clearing the hold performs the pending release - without this, the claims are gone,
        // nothing ever re-sends the release, and the record leaks forever
        assert!(matches!(vault.set_legal_hold(1, false, 300), VaultOpOutcome::ReleasePin(_)));
        assert!(vault.record_for_file(&1).is_none());
        assert!(vault.record_for_file(&2).is_none());
    }

    #[test]
    fn expiry_and_metrics_respect_unverdicted_sibling_claims() {
        let mut vault = vault_with_reviewer();
        vault.quarantine(1, [1u8; 32], "image/png".to_string(), metadata(7), 100);
        vault.quarantine(2, [1u8; 32], "image/png".to_string(), metadata(8), 101);

        // Report 7's verdict starts the clock, but report 8 still awaits one: the record must
        // stay on the unresolved metric and must NOT expire out from under report 8
        vault.apply_verdict(1, 999, None, false, Some(7), 200);
        assert_eq!(vault.metrics().unresolved_quarantines, 1);
        assert!(vault.remove_expired(10_000).is_empty());
        assert!(vault.record_for_file(&2).is_some());

        // Report 8's verdict resolves the last claim: metric clears and expiry may proceed
        vault.apply_verdict(2, 999, None, false, Some(8), 300);
        assert_eq!(vault.metrics().unresolved_quarantines, 0);
        assert_eq!(vault.remove_expired(10_000).len(), 1);
        assert!(vault.record_for_file(&1).is_none());
    }

    #[test]
    fn csam_hash_denylisted_by_verdict_and_survives_release() {
        let mut vault = vault_with_reviewer();
        let hash = [1u8; 32];
        vault.quarantine(1, hash, "image/png".to_string(), metadata(7), 100);
        assert!(!vault.is_csam_hash(&hash));

        vault.apply_verdict(1, 999, None, false, Some(7), 200);
        assert_eq!(vault.known_csam_report_index(&hash), Some(7));

        // Expiry releases the record but never the denylist entry
        assert_eq!(vault.remove_expired(10_000).len(), 1);
        assert!(vault.record_for_file(&1).is_none());
        assert!(vault.is_csam_hash(&hash));

        // A dismissal-driven release never denylists
        let other = [2u8; 32];
        vault.quarantine(2, other, "image/png".to_string(), metadata(8), 300);
        assert!(matches!(
            vault.unquarantine(2, None, Some(8), 400),
            VaultOpOutcome::ReleasePin(_)
        ));
        assert!(!vault.is_csam_hash(&other));
    }

    #[test]
    fn blocked_attempts_report_once_per_uploader_and_file() {
        let mut vault = vault_with_reviewer();
        // First sighting reports; the parallel/retried chunks of the same attempt do not
        assert!(vault.record_blocked_attempt(reviewer(1), 42));
        assert!(!vault.record_blocked_attempt(reviewer(1), 42));
        // A different user attempting the same file is a fresh attempt
        assert!(vault.record_blocked_attempt(reviewer(2), 42));
    }

    #[test]
    fn backfill_denylists_previously_verdicted_records() {
        let mut vault = vault_with_reviewer();
        vault.quarantine(1, [1u8; 32], "image/png".to_string(), metadata(7), 100);
        vault.apply_verdict(1, 999, None, false, Some(7), 200);

        // Simulate a record verdicted before the denylist existed
        vault.csam_hashes.clear();
        assert!(!vault.is_csam_hash(&[1u8; 32]));

        vault.backfill_csam_hashes();
        assert_eq!(vault.known_csam_report_index(&[1u8; 32]), Some(7));
    }

    #[test]
    fn record_compat_infers_verdict_applied_from_retention() {
        // The record shape from before verdict_applied existed
        #[derive(Serialize)]
        struct OldRecord {
            hash: Hash,
            original_file_id: FileId,
            mime_type: String,
            metadata: VaultCaptureMetadata,
            quarantined_at: TimestampMillis,
            retention_until: Option<TimestampMillis>,
            legal_hold: bool,
        }
        let old = |retention_until| OldRecord {
            hash: [1u8; 32],
            original_file_id: 1,
            mime_type: "image/png".to_string(),
            metadata: metadata(0),
            quarantined_at: 100,
            retention_until,
            legal_hold: false,
        };

        // Old records only ever had retention set by a verdict, so infer resolution from it
        let bytes = msgpack::serialize_then_unwrap(old(Some(999)));
        let record: VaultRecord = msgpack::deserialize_then_unwrap(&bytes);
        assert!(record.verdict_applied);

        let bytes = msgpack::serialize_then_unwrap(old(None));
        let record: VaultRecord = msgpack::deserialize_then_unwrap(&bytes);
        assert!(!record.verdict_applied);
    }

    #[test]
    fn reviewer_compat_accepts_old_principal_set() {
        #[derive(Serialize)]
        struct OldHolder {
            reviewers: HashSet<Principal>,
        }
        #[derive(Deserialize)]
        struct Holder {
            #[serde(default, deserialize_with = "deserialize_reviewers")]
            reviewers: HashMap<Principal, UserId>,
        }
        let bytes = msgpack::serialize_then_unwrap(OldHolder {
            reviewers: [reviewer(1)].into_iter().collect(),
        });
        let holder: Holder = msgpack::deserialize(bytes.as_slice()).unwrap();
        assert!(holder.reviewers.is_empty());

        #[derive(Serialize)]
        struct NewHolder {
            reviewers: HashMap<Principal, UserId>,
        }
        let user_id: UserId = Principal::from_slice(&[9; 8]).into();
        let bytes = msgpack::serialize_then_unwrap(NewHolder {
            reviewers: [(reviewer(1), user_id)].into_iter().collect(),
        });
        let holder: Holder = msgpack::deserialize(bytes.as_slice()).unwrap();
        assert_eq!(holder.reviewers.get(&reviewer(1)), Some(&user_id));
    }
}
