use crate::serde_utils::deserialize_int_or_string;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Formatter};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct Document {
    #[serde(deserialize_with = "deserialize_int_or_string")]
    pub id: u128,
    pub mime_type: String,
    #[serde(with = "serde_bytes")]
    pub data: Vec<u8>,
}

impl Document {
    pub fn id(avatar: &Option<Document>) -> Option<u128> {
        avatar.as_ref().map(|a| a.id)
    }
}

impl Debug for Document {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Avatar")
            .field("id", &self.id)
            .field("mime_type", &self.mime_type)
            .field("byte_length", &self.data.len())
            .finish()
    }
}
