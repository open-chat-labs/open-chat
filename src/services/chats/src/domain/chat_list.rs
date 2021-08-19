use super::chat::{Chat, ChatEnum, ChatSummary, MessageContent};
use super::direct_chat::DirectChat;
use super::group_chat::GroupChat;
use crate::domain::blob_storage::BlobStorage;
use crate::domain::chat::Message;
use crate::domain::chat::{ChatStableState, MessageContentType, ReplyContext};
use crate::domain::group_chat::GroupChatSummary;
use crate::domain::user_to_chats_map::UserToChatsMap;
use core::cmp::min;
use core::ops::RangeTo;
use ic_cdk::export::candid::CandidType;
use serde::Deserialize;
use shared::chat_id::ChatId;
use shared::storage::StableState;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use std::collections::VecDeque;
use std::collections::{
    hash_map::Entry::{Occupied, Vacant},
    HashMap,
};

#[derive(Default)]
pub struct ChatList {
    chats: HashMap<ChatId, ChatEnum>,
    user_to_chats_map: UserToChatsMap,
    messages_to_prune: VecDeque<(ChatId, u32)>,
    stats: Stats,
}

#[derive(CandidType, Deserialize)]
pub struct ChatListState {
    chats: Vec<ChatStableState>,
    messages_to_prune: Vec<(ChatId, u32)>,
    stats: Stats,
}

#[derive(Clone, Default, CandidType, Deserialize)]
pub struct Stats {
    pub direct_chat_count: u32,
    pub group_chat_count: u32,
    pub text_message_count: u64,
    pub image_message_count: u64,
    pub video_message_count: u64,
    pub file_message_count: u64,
    pub cycles_message_count: u64,
    pub cycles_transferred: u128,
    pub pruneable_message_count: u32,
}

impl ChatList {
    pub fn create_direct_chat(
        &mut self,
        chat_id: ChatId,
        sender: UserId,
        recipient: UserId,
        now: Timestamp,
    ) {
        let chat = DirectChat::new(chat_id, sender, recipient, now);
        let chat_enum = ChatEnum::Direct(chat);
        self.chats.insert(chat_id, chat_enum);
        self.user_to_chats_map.link_chat_to_user(chat_id, sender);
        self.user_to_chats_map.link_chat_to_user(chat_id, recipient);
        self.stats.direct_chat_count += 1;
    }

    pub fn create_group_chat(
        &mut self,
        creator: UserId,
        chat_id: ChatId,
        subject: String,
        participants: Vec<UserId>,
        chat_history_visible_to_new_joiners: bool,
        now: Timestamp,
    ) -> Option<GroupChatSummary> {
        match self.chats.entry(chat_id) {
            Occupied(_) => None,
            Vacant(e) => {
                self.user_to_chats_map.link_chat_to_user(chat_id, creator);
                for p in participants.iter() {
                    self.user_to_chats_map.link_chat_to_user(chat_id, *p);
                }

                let chat = GroupChat::new(
                    chat_id,
                    subject,
                    creator,
                    participants,
                    chat_history_visible_to_new_joiners,
                    now,
                );
                let chat_summary = GroupChatSummary::new(&chat, &creator, 0);

                e.insert(ChatEnum::Group(chat));
                self.stats.group_chat_count += 1;
                Some(chat_summary)
            }
        }
    }

    pub fn get(&self, chat_id: ChatId, me: &UserId) -> Option<&ChatEnum> {
        let chat = self.chats.get(&chat_id)?;
        if !chat.involves_user(me) {
            return None;
        }
        Some(chat)
    }

    pub fn get_mut(&mut self, chat_id: ChatId, me: &UserId) -> Option<&mut ChatEnum> {
        let chat = self.chats.get_mut(&chat_id)?;
        if !chat.involves_user(me) {
            return None;
        }
        Some(chat)
    }

    pub fn get_unchecked_mut(&mut self, chat_id: ChatId) -> Option<&mut ChatEnum> {
        self.chats.get_mut(&chat_id)
    }

    pub fn get_all(&self, me: &UserId) -> Vec<&ChatEnum> {
        if let Some(chats) = self.user_to_chats_map.get_chats(me) {
            chats.iter().filter_map(|c| self.chats.get(c)).collect()
        } else {
            Vec::new()
        }
    }

    pub fn get_summaries(
        &self,
        user: &UserId,
        updated_since: Option<Timestamp>,
        message_count_for_top_chat: Option<u16>,
    ) -> Vec<ChatSummary> {
        let top_message_count = match message_count_for_top_chat {
            Some(c) => c as u32,
            None => 1,
        };

        let mut list: Vec<_> = self
            .get_all(user)
            .into_iter()
            .filter(|chat| {
                updated_since.is_none() || chat.get_updated_date() > updated_since.unwrap()
            })
            .collect();

        list.sort_unstable_by(|c1, c2| {
            let t1 = c1.get_display_date(user);
            let t2 = c2.get_display_date(user);
            t2.cmp(&t1)
        });

        list.iter()
            .enumerate()
            .map(|(i, chat)| chat.to_summary(user, if i == 0 { top_message_count } else { 1 }))
            .collect()
    }

    pub fn delete_chat(&mut self, chat_id: ChatId) {
        if let Some(chat) = self.chats.remove(&chat_id) {
            match chat {
                ChatEnum::Direct(c) => {
                    let [user1, user2] = c.get_participants();
                    self.user_to_chats_map
                        .unlink_chat_from_user(&chat_id, user1);
                    self.user_to_chats_map
                        .unlink_chat_from_user(&chat_id, user2);
                    self.stats.direct_chat_count -= 1;
                }
                ChatEnum::Group(c) => {
                    for p in c.iter_participants() {
                        self.user_to_chats_map.unlink_chat_from_user(&chat_id, p);
                    }
                    self.stats.group_chat_count -= 1
                }
            }
        }
    }

    pub fn push_message(
        &mut self,
        chat_id: ChatId,
        me: &UserId,
        client_message_id: String,
        content: MessageContent,
        replies_to: Option<ReplyContext>,
        now: Timestamp,
    ) -> Option<Message> {
        self.add_message_to_stats(&content);

        match self.get_mut(chat_id, me) {
            Some(chat) => {
                let is_blob = content.is_blob();
                let message = chat.push_message(me, client_message_id, content, replies_to, now);
                let message_id = message.get_id();

                if is_blob {
                    self.messages_to_prune.push_back((chat_id, message_id));
                    self.stats.pruneable_message_count += 1;
                }

                Some(message)
            }
            None => None,
        }
    }

    pub fn prune_messages(&mut self, blob_storage: &mut BlobStorage) {
        const MEMORY_LIMIT_BYTES: u64 = 1024 * 1024 * 1024; // 1GB
        if blob_storage.get_total_bytes() <= MEMORY_LIMIT_BYTES {
            return;
        }

        const PRUNE_MESSAGES_COUNT: u32 = 20;
        let count_to_prune = min(PRUNE_MESSAGES_COUNT, self.messages_to_prune.len() as u32);

        if count_to_prune > 0 {
            let messages: Vec<_> = self
                .messages_to_prune
                .drain(RangeTo {
                    end: count_to_prune as usize,
                })
                .collect();

            for (chat_id, message_id) in messages {
                if let Some(chat) = self.chats.get_mut(&chat_id) {
                    if let Some(message) = chat.get_message_mut(message_id) {
                        message.delete_blob_content(blob_storage);
                    }
                }
            }

            self.stats.pruneable_message_count -= count_to_prune;
        }
    }

    pub fn link_chat_to_user(&mut self, chat_id: ChatId, user_id: UserId) {
        self.user_to_chats_map.link_chat_to_user(chat_id, user_id);
    }

    pub fn unlink_chat_from_user(&mut self, chat_id: &ChatId, user_id: &UserId) {
        self.user_to_chats_map
            .unlink_chat_from_user(chat_id, user_id);
    }

    pub fn get_stats(&self) -> Stats {
        self.stats.clone()
    }

    fn add_message_to_stats(&mut self, content: &MessageContent) {
        match content.get_type() {
            MessageContentType::Text => self.stats.text_message_count += 1,
            MessageContentType::Image => self.stats.image_message_count += 1,
            MessageContentType::Video => self.stats.video_message_count += 1,
            MessageContentType::File => self.stats.file_message_count += 1,
            MessageContentType::Cycles => {
                self.stats.cycles_message_count += 1;
                if let MessageContent::Cycles(c) = content {
                    self.stats.cycles_transferred += c.get_amount();
                }
            }
        }
    }
}

impl StableState for ChatList {
    type State = ChatListState;

    fn drain(self) -> ChatListState {
        let chats: Vec<ChatStableState> = self.chats.into_iter().map(|(_, c)| c.into()).collect();
        let messages_to_prune: Vec<(ChatId, u32)> = self.messages_to_prune.into_iter().collect();
        ChatListState {
            chats,
            messages_to_prune,
            stats: self.stats,
        }
    }

    fn fill(state: ChatListState) -> ChatList {
        let mut chats_map: HashMap<ChatId, ChatEnum> = HashMap::new();
        let mut user_to_chats_map: UserToChatsMap = UserToChatsMap::default();
        for c in state.chats.into_iter() {
            let chat_id = c.get_id();
            match &c {
                ChatStableState::Direct(c) => {
                    let [user1, user2] = c.get_participants();
                    user_to_chats_map.link_chat_to_user(chat_id, *user1);
                    user_to_chats_map.link_chat_to_user(chat_id, *user2);
                }
                ChatStableState::Group(c) => {
                    for p in c.iter_participants() {
                        user_to_chats_map.link_chat_to_user(chat_id, *p);
                    }
                }
            }
            chats_map.insert(chat_id, c.into());
        }
        let messages_to_prune_deque: VecDeque<(ChatId, u32)> =
            state.messages_to_prune.into_iter().collect();

        ChatList {
            chats: chats_map,
            user_to_chats_map,
            messages_to_prune: messages_to_prune_deque,
            stats: state.stats,
        }
    }
}
