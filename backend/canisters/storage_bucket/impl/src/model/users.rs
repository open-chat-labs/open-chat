use crate::model::users_map::UsersMap;
use candid::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::StableMemoryMap;
use std::collections::{BTreeMap, BTreeSet};
use tracing::info;
use types::{FileId, RejectedReason};

#[derive(Serialize, Deserialize, Default)]
pub struct Users {
    users: BTreeMap<Principal, UserRecord>,
    #[serde(default)]
    users_stable: UsersMap,
}

impl Users {
    pub fn migrate_users(&mut self) -> bool {
        if self.users.is_empty() {
            return true;
        }

        let mut count = 0;
        while ic_cdk::api::instruction_counter() < 3_000_000_000 {
            if let Some((principal, user_record)) = self.users.pop_first() {
                self.users_stable.insert(principal, user_record);
                count += 1;
            } else {
                break;
            }
        }

        info!(count, "Migrated users to stable memory");
        self.users.is_empty()
    }

    pub fn add(&mut self, user_id: Principal) -> bool {
        if !self.exists(&user_id) {
            self.users_stable.insert(user_id, UserRecord::default());
            true
        } else {
            false
        }
    }

    pub fn remove(&mut self, user_id: &Principal) -> Option<UserRecord> {
        self.users
            .remove(user_id)
            .or_else(|| self.users_stable.remove(user_id).map(|v| v.into_value()))
    }

    pub fn exists(&self, user_id: &Principal) -> bool {
        self.users.contains_key(user_id) || self.users_stable.contains_key(user_id)
    }

    pub fn get(&self, user_id: &Principal) -> Option<UserRecord> {
        self.users.get(user_id).cloned().or_else(|| self.users_stable.get(user_id))
    }

    pub fn set_file_status(
        &mut self,
        user_id: Principal,
        mut user_record: UserRecord,
        file_id: FileId,
        status: FileStatusInternal,
    ) -> Option<FileStatusInternal> {
        let previous = user_record.set_file_status(file_id, status);

        if self.users.contains_key(&user_id) {
            self.users.insert(user_id, user_record);
        } else {
            self.users_stable.insert(user_id, user_record);
        }

        previous
    }

    pub fn update_user_id(&mut self, old_user_id: Principal, new_user_id: Principal) -> bool {
        if let Some(user) = self.remove(&old_user_id) {
            self.users_stable.insert(new_user_id, user);
            true
        } else {
            false
        }
    }

    pub fn len(&self) -> usize {
        self.users.len() + self.users_stable.len()
    }
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(from = "UserRecordPrevious")]
pub struct UserRecord {
    #[serde(rename = "p", alias = "files_owned", default, skip_serializing_if = "BTreeMap::is_empty")]
    files_pending: BTreeMap<FileId, FileStatusInternal>,
    #[serde(rename = "c", default, skip_serializing_if = "BTreeSet::is_empty")]
    files_complete: BTreeSet<FileId>,
}

#[derive(Serialize, Deserialize, Default)]
struct UserRecordPrevious {
    #[serde(rename = "p", alias = "files_owned", default, skip_serializing_if = "BTreeMap::is_empty")]
    files_pending: BTreeMap<FileId, FileStatusInternal>,
    #[serde(rename = "c", default, skip_serializing_if = "BTreeSet::is_empty")]
    files_complete: BTreeSet<FileId>,
}

impl From<UserRecordPrevious> for UserRecord {
    fn from(value: UserRecordPrevious) -> Self {
        let mut pending = BTreeMap::new();
        let mut complete = value.files_complete;

        for (file_id, status) in value.files_pending {
            if status.is_complete() {
                complete.insert(file_id);
            } else {
                pending.insert(file_id, status);
            }
        }

        UserRecord {
            files_pending: pending,
            files_complete: complete,
        }
    }
}

impl UserRecord {
    pub fn files_owned(&self) -> Vec<FileId> {
        self.files_pending.keys().chain(self.files_complete.iter()).copied().collect()
    }

    pub fn file_status(&self, file_id: &FileId) -> Option<&FileStatusInternal> {
        if self.files_complete.contains(file_id) {
            Some(&FileStatusInternal::COMPLETE)
        } else {
            self.files_pending.get(file_id)
        }
    }

    pub fn set_file_status(&mut self, file_id: FileId, status: FileStatusInternal) -> Option<FileStatusInternal> {
        if status.is_complete() {
            if !self.files_complete.insert(file_id) {
                Some(FileStatusInternal::COMPLETE.clone())
            } else {
                self.files_pending.remove(&file_id)
            }
        } else {
            self.files_pending.insert(file_id, status)
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub enum FileStatusInternal {
    #[serde(rename = "c")]
    Complete(IndexSyncComplete),
    #[serde(rename = "u")]
    Uploading(IndexSyncComplete),
    #[serde(rename = "r")]
    Rejected(RejectedReason),
}

impl FileStatusInternal {
    const COMPLETE: FileStatusInternal = FileStatusInternal::Complete(IndexSyncComplete::Yes);

    fn is_complete(&self) -> bool {
        matches!(self, Self::Complete(IndexSyncComplete::Yes))
    }
}

#[derive(Serialize, Deserialize, Copy, Clone)]
pub enum IndexSyncComplete {
    #[serde(rename = "y")]
    Yes,
    #[serde(rename = "n")]
    No,
}
