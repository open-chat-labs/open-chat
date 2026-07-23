use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use storage_bucket_canister::c2c_vault_sync::VaultCaptureMetadata;
use types::{FileId, Hash, TimestampMillis};
use utils::hasher::hash_bytes;

// Evidence vault: metadata, retention state and the append-only access log for quarantined
// blobs. The blob bytes themselves stay in `Files`, kept alive by a vault pin on the hash so
// that no existing deletion path can remove them (see Files::vault_pin).
#[derive(Serialize, Deserialize, Default)]
pub struct Vault {
    records: BTreeMap<Hash, VaultRecord>,
    file_id_to_hash: BTreeMap<FileId, Hash>,
    reviewers: HashSet<Principal>,
    log: Vec<VaultLogEntry>,
}

#[derive(Serialize, Deserialize)]
pub struct VaultRecord {
    pub hash: Hash,
    pub original_file_id: FileId,
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
    Quarantined(FileId),
    Unquarantined(FileId),
    VerdictApplied(FileId, TimestampMillis),
    LegalHoldSet(FileId),
    LegalHoldCleared(FileId),
    Destroyed(FileId, String),
    RetentionExpired(FileId),
    Viewed(FileId, Principal, u32),
}

pub enum VaultOpOutcome {
    Applied,
    // The blob is no longer referenced by the vault and its pin should be released
    ReleasePin(Hash),
    NotFound,
}

impl Vault {
    pub fn set_reviewers(&mut self, reviewers: Vec<Principal>) {
        self.reviewers = reviewers.into_iter().collect();
    }

    pub fn is_reviewer(&self, principal: &Principal) -> bool {
        self.reviewers.contains(principal)
    }

    pub fn hash_for_file(&self, file_id: &FileId) -> Option<Hash> {
        self.file_id_to_hash.get(file_id).copied()
    }

    // Returns false if the hash is already quarantined (the pin is already held)
    pub fn quarantine(&mut self, file_id: FileId, hash: Hash, metadata: VaultCaptureMetadata, now: TimestampMillis) -> bool {
        self.file_id_to_hash.insert(file_id, hash);
        self.append_log(VaultLogEvent::Quarantined(file_id), now);

        match self.records.entry(hash) {
            std::collections::btree_map::Entry::Occupied(_) => false,
            std::collections::btree_map::Entry::Vacant(e) => {
                e.insert(VaultRecord {
                    hash,
                    original_file_id: file_id,
                    metadata,
                    quarantined_at: now,
                    retention_until: None,
                    legal_hold: false,
                });
                true
            }
        }
    }

    pub fn unquarantine(&mut self, file_id: FileId, now: TimestampMillis) -> VaultOpOutcome {
        let Some(hash) = self.file_id_to_hash.remove(&file_id) else {
            return VaultOpOutcome::NotFound;
        };
        self.records.remove(&hash);
        self.append_log(VaultLogEvent::Unquarantined(file_id), now);
        VaultOpOutcome::ReleasePin(hash)
    }

    pub fn apply_verdict(&mut self, file_id: FileId, retention_until: TimestampMillis, now: TimestampMillis) -> VaultOpOutcome {
        let Some(record) = self.file_id_to_hash.get(&file_id).and_then(|h| self.records.get_mut(h)) else {
            return VaultOpOutcome::NotFound;
        };
        record.retention_until = Some(retention_until);
        self.append_log(VaultLogEvent::VerdictApplied(file_id, retention_until), now);
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

    // Permanent destruction on law enforcement request, overriding the retention clock.
    // The log entry (including the request reference) survives the record.
    pub fn destroy(&mut self, file_id: FileId, le_request_ref: String, now: TimestampMillis) -> VaultOpOutcome {
        let Some(hash) = self.file_id_to_hash.remove(&file_id) else {
            return VaultOpOutcome::NotFound;
        };
        self.records.remove(&hash);
        self.append_log(VaultLogEvent::Destroyed(file_id, le_request_ref), now);
        VaultOpOutcome::ReleasePin(hash)
    }

    pub fn log_view(&mut self, file_id: FileId, reviewer: Principal, chunk_index: u32, now: TimestampMillis) {
        self.append_log(VaultLogEvent::Viewed(file_id, reviewer, chunk_index), now);
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

        for (file_id, hash) in expired.iter() {
            self.records.remove(hash);
            self.file_id_to_hash.retain(|_, h| h != hash);
            self.append_log(VaultLogEvent::RetentionExpired(*file_id), now);
        }

        expired.into_iter().map(|(_, hash)| hash).collect()
    }

    pub fn metrics(&self) -> VaultMetrics {
        VaultMetrics {
            quarantined: self.records.len() as u64,
            legal_holds: self.records.values().filter(|r| r.legal_hold).count() as u64,
            reviewers: self.reviewers.len() as u64,
            log_length: self.log.len() as u64,
        }
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

    fn entry_hash(entry: &VaultLogEntry) -> Hash {
        hash_bytes(msgpack::serialize_then_unwrap(entry))
    }
}

#[derive(Debug)]
pub struct VaultMetrics {
    pub quarantined: u64,
    pub legal_holds: u64,
    pub reviewers: u64,
    pub log_length: u64,
}
