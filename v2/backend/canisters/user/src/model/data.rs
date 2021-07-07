use crate::model::direct_chat::DirectChat;
use crate::model::group_chat::GroupChat;
use candid::Principal;
use serde_bytes::ByteBuf;
use shared::types::{ChatId, UserId};
use std::collections::{HashMap, HashSet};

pub struct Data {
    pub owner: Principal,
    pub direct_chats: HashMap<ChatId, DirectChat>,
    pub group_chats: HashMap<ChatId, GroupChat>,
    pub blobs: HashMap<String, Vec<ByteBuf>>,
    pub blocked_users: HashSet<UserId>,
}

impl Data {
    pub fn new(owner: Principal) -> Data {
        Data {
            owner,
            direct_chats: HashMap::new(),
            group_chats: HashMap::new(),
            blobs: HashMap::new(),
            blocked_users: HashSet::new(),
        }
    }
}
