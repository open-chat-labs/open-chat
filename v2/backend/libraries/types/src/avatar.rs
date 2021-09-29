use candid::CandidType;
use serde::Deserialize;
use serde_bytes::ByteBuf;

pub const MAX_AVATAR_SIZE: u64 = 1024 * 1024; // 1MB

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Avatar {
    pub id: u128,
    pub mime_type: String,
    pub data: ByteBuf,
}

impl Avatar {
    pub fn id(avatar: &Option<Avatar>) -> Option<u128> {
        avatar.as_ref().map(|a| a.id)
    }
}
