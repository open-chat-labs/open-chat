use crate::model::direct_chat::DirectChat;
use crate::model::group_chat::GroupChat;
use candid::Principal;
use serde_bytes::ByteBuf;
use shared::types::chat_id::{DirectChatId, GroupChatId};
use shared::types::{CanisterId, UserId, Version};
use std::collections::{HashMap, HashSet};

pub struct Data {
    pub owner: Principal,
    pub direct_chats: HashMap<DirectChatId, DirectChat>,
    pub group_chats: HashMap<GroupChatId, GroupChat>,
    pub blobs: HashMap<String, Vec<ByteBuf>>,
    pub blocked_users: HashSet<UserId>,
    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notification_canister_ids: Vec<CanisterId>,
    pub wasm_version: Version,
}

impl Data {
    pub fn new(
        owner: Principal,
        user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        notification_canister_ids: Vec<CanisterId>,
        wasm_version: Version,
    ) -> Data {
        Data {
            owner,
            direct_chats: HashMap::new(),
            group_chats: HashMap::new(),
            blobs: HashMap::new(),
            blocked_users: HashSet::new(),
            user_index_canister_id,
            group_index_canister_id,
            notification_canister_ids,
            wasm_version,
        }
    }
}
