use crate::model::direct_chat::DirectChat;
use crate::model::group_chat::GroupChat;
use candid::Principal;
use serde_bytes::ByteBuf;
use shared::types::chat_id::{DirectChatId, GroupChatId};
use shared::types::{CanisterId, UserId};
use std::collections::{HashMap, HashSet};

pub struct Data {
    pub owner: Principal,
    pub direct_chats: HashMap<DirectChatId, DirectChat>,
    pub group_chats: HashMap<GroupChatId, GroupChat>,
    pub blobs: HashMap<String, Vec<ByteBuf>>,
    pub blocked_users: HashSet<UserId>,
    pub notification_canister_ids: Vec<CanisterId>,
}

impl Data {
    pub fn new(owner: Principal, notification_canister_ids: Vec<CanisterId>) -> Data {
        Data {
            owner,
            direct_chats: HashMap::new(),
            group_chats: HashMap::new(),
            blobs: HashMap::new(),
            blocked_users: HashSet::new(),
            notification_canister_ids,
        }
    }
}
