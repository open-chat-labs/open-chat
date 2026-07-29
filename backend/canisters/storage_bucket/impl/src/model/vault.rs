use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};
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
    // Ephemeral read sessions: (reviewer, file_id) -> next expected chunk. Not serialized:
    // an upgrade resets sessions and reviewers restart from chunk 0 (an extra logged act,
    // never an unlogged one).
    #[serde(skip)]
    sessions: BTreeMap<(Principal, FileId), u32>,
}

#[derive(Serialize, Deserialize)]
pub struct VaultRecord {
    pub hash: Hash,
    pub original_file_id: FileId,
    // Captured at quarantine time since the file record may be deleted while the blob is vaulted
    #[serde(default)]
    pub mime_type: String,
    pub metadata: VaultCaptureMetadata,
    pub quarantined_at: TimestampMillis,
    pub retention_until: Option<TimestampMillis>,
    pub legal_hold: bool,
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
            | VaultLogEvent::VerdictAppliedBy(file_id, _, _) => *file_id,
        }
    }
}

pub enum VaultOpOutcome {
    Applied,
    // The blob is no longer referenced by the vault and its pin should be released
    ReleasePin(Hash),
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
        self.records.entry(hash).or_insert(VaultRecord {
            hash,
            original_file_id: file_id,
            mime_type,
            metadata,
            quarantined_at: now,
            retention_until: None,
            legal_hold: false,
        });
    }

    pub fn record_quarantine_failure(&mut self) {
        self.quarantine_failures += 1;
    }

    pub fn unquarantine(&mut self, file_id: FileId, moderator: Option<UserId>, now: TimestampMillis) -> VaultOpOutcome {
        let Some(hash) = self.file_id_to_hash.get(&file_id).copied() else {
            return VaultOpOutcome::NotFound;
        };
        if self.records.get(&hash).is_some_and(|r| r.legal_hold) {
            // A legal hold blocks release; it must be explicitly cleared first (LE-requested
            // destruction is the only operation which overrides a hold)
            return VaultOpOutcome::Blocked;
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
        now: TimestampMillis,
    ) -> VaultOpOutcome {
        let Some(record) = self.file_id_to_hash.get(&file_id).and_then(|h| self.records.get_mut(h)) else {
            return VaultOpOutcome::NotFound;
        };
        record.retention_until = Some(retention_until);
        self.append_log(VaultLogEvent::VerdictAppliedBy(file_id, retention_until, moderator), now);
        VaultOpOutcome::Applied
    }

    pub fn set_legal_hold(&mut self, file_id: FileId, legal_hold: bool, now: TimestampMillis) -> VaultOpOutcome {
        let Some(record) = self.file_id_to_hash.get(&file_id).and_then(|h| self.records.get_mut(h)) else {
            return VaultOpOutcome::NotFound;
        };
        record.legal_hold = legal_hold;
        let event = if legal_hold {
            VaultLogEvent::LegalHoldSet(file_id)
        } else {
            VaultLogEvent::LegalHoldCleared(file_id)
        };
        self.append_log(event, now);
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
            .filter(|r| !r.legal_hold && r.retention_until.is_some_and(|ts| ts <= now))
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
        // A record with no retention_until has had no verdict: unresolved quarantines pin
        // media indefinitely with nothing else watching, so surface the count and the oldest
        VaultMetrics {
            quarantined: self.records.len() as u64,
            legal_holds: self.records.values().filter(|r| r.legal_hold).count() as u64,
            reviewers: self.reviewers.len() as u64,
            log_length: self.log.len() as u64,
            quarantine_failures: self.quarantine_failures,
            unresolved_quarantines: self.records.values().filter(|r| r.retention_until.is_none()).count() as u64,
            oldest_unresolved_quarantined_at: self
                .records
                .values()
                .filter(|r| r.retention_until.is_none())
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
        vault.apply_verdict(1, 999, Some(Principal::from_slice(&[9; 8]).into()), 300);

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
        assert!(matches!(vault.unquarantine(1, None, 300), VaultOpOutcome::Blocked));
        vault.set_legal_hold(1, false, 400);
        assert!(matches!(vault.unquarantine(1, None, 500), VaultOpOutcome::ReleasePin(_)));
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
