use crate::types::{CanisterId, UserId};
use candid::CandidType;
use serde::Deserialize;
use std::cmp::max;

#[derive(CandidType, Deserialize, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct DirectChatId(Vec<u8>);

#[derive(CandidType, Deserialize, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct GroupChatId(CanisterId);

impl From<(&UserId, &UserId)> for DirectChatId {
    fn from((my_user_id, their_user_id): (&UserId, &UserId)) -> Self {
        let s1 = my_user_id.0.as_slice();
        let s2 = their_user_id.0.as_slice();
        let length = max(s1.len(), s2.len());

        let mut xor_bytes = Vec::with_capacity(length);
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
