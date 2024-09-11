use candid::CandidType;
use std::fmt::{Debug, Formatter};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Clone)]
pub struct Document {
    pub id: u128,
    pub mime_type: String,
    #[serde(with = "serde_bytes")]
    #[ts(as = "Vec::<u8>")]
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
