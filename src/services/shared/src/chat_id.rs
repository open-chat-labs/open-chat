use std::ops::Shl;
use ic_cdk::export::candid::CandidType;
use highway::{HighwayHasher, HighwayHash};
use serde::{Deserialize, Serialize};
use crate::user_id::UserId;

#[derive(CandidType, Serialize, Deserialize, PartialEq, Eq, Hash, Copy, Clone)]
pub struct ChatId(pub u128);

impl ChatId {
    pub fn for_direct_chat(user1: &UserId, user2: &UserId) -> ChatId {
        let mut hasher = HighwayHasher::default();

        if user1 < user2 {
            hasher.append(user1.as_slice());
            hasher.append(user2.as_slice());
        } else {
            hasher.append(user2.as_slice());
            hasher.append(user1.as_slice());
        }

        let hash_parts = hasher.finalize128();
        let hash1: u128 = hash_parts[0].into();
        let hash2: u128 = hash_parts[1].into();
        let hash: u128 = hash1.shl(64) + hash2;

        ChatId(hash)
    }
}