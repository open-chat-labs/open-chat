use crate::types::{CanisterId, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

const DIRECT_CHAT_ID_LENGTH_BYTES: usize = 29; // Same length as Principal

#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct DirectChatId([u8; DIRECT_CHAT_ID_LENGTH_BYTES]);

#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct GroupChatId(CanisterId);

impl From<(&UserId, &UserId)> for DirectChatId {
    fn from((my_user_id, their_user_id): (&UserId, &UserId)) -> Self {
        let s1 = my_user_id.0.as_slice();
        let s2 = their_user_id.0.as_slice();

        let mut xor_bytes = [0; DIRECT_CHAT_ID_LENGTH_BYTES];
        for (i, byte) in xor_bytes.iter_mut().enumerate() {
            *byte = s1.get(i).unwrap_or(&0) ^ s2.get(i).unwrap_or(&0);
        }

        DirectChatId(xor_bytes)
    }
}

impl From<CanisterId> for GroupChatId {
    fn from(canister_id: CanisterId) -> Self {
        GroupChatId(canister_id)
    }
}
