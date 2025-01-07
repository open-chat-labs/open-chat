use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::btree_map::Entry::Vacant;
use std::collections::BTreeMap;
use types::{FileId, RejectedReason};

#[derive(Serialize, Deserialize, Default)]
pub struct Users {
    users: BTreeMap<Principal, UserRecord>,
}

impl Users {
    pub fn add(&mut self, user_id: Principal) -> bool {
        if let Vacant(e) = self.users.entry(user_id) {
            e.insert(UserRecord::default());
            true
        } else {
            false
        }
    }

    pub fn remove(&mut self, user_id: &Principal) -> Option<UserRecord> {
        self.users.remove(user_id)
    }

    pub fn exists(&self, user_id: &Principal) -> bool {
        self.users.contains_key(user_id)
    }

    pub fn get(&self, user_id: &Principal) -> Option<&UserRecord> {
        self.users.get(user_id)
    }

    pub fn get_mut(&mut self, user_id: &Principal) -> Option<&mut UserRecord> {
        self.users.get_mut(user_id)
    }

    pub fn update_user_id(&mut self, old_user_id: Principal, new_user_id: Principal) -> bool {
        if let Some(user) = self.users.remove(&old_user_id) {
            self.users.insert(new_user_id, user);
            true
        } else {
            false
        }
    }

    pub fn len(&self) -> usize {
        self.users.len()
    }
}

#[derive(Serialize, Deserialize, Default)]
pub struct UserRecord {
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    files_owned: BTreeMap<FileId, FileStatusInternal>,
}

impl UserRecord {
    pub fn files_owned(&self) -> Vec<FileId> {
        self.files_owned.keys().copied().collect()
    }

    pub fn file_status(&self, file_id: &FileId) -> Option<&FileStatusInternal> {
        self.files_owned.get(file_id)
    }

    pub fn set_file_status(&mut self, file_id: FileId, status: FileStatusInternal) -> Option<FileStatusInternal> {
        self.files_owned.insert(file_id, status)
    }
}

#[derive(Serialize, Deserialize)]
pub enum FileStatusInternal {
    #[serde(rename = "c", alias = "Complete")]
    Complete(IndexSyncComplete),
    #[serde(rename = "u", alias = "Uploading")]
    Uploading(IndexSyncComplete),
    #[serde(rename = "r", alias = "Rejected")]
    Rejected(RejectedReason),
}

#[derive(Serialize, Deserialize, Copy, Clone)]
pub enum IndexSyncComplete {
    #[serde(rename = "y", alias = "Yes")]
    Yes,
    #[serde(rename = "n", alias = "No")]
    No,
}
