use core::ops::RangeTo;
use core::cmp::min;
use ic_cdk::export::candid::CandidType;
use serde::Deserialize;
use std::collections::VecDeque;
use std::collections::{HashMap, hash_map::Entry::{Occupied, Vacant}};
use shared::chat_id::ChatId;
use shared::timestamp::Timestamp;
use shared::storage::StableState;
use shared::user_id::UserId;
use super::chat::{Chat, ChatEnum, ChatSummary, MessageContent};
use super::direct_chat::DirectChat;
use super::group_chat::GroupChat;
use crate::domain::blob_storage::BlobStorage;
use crate::domain::chat::{ChatStableState, MessageContentType, ReplyContext};
use crate::domain::direct_chat::DirectChatSummary;
use crate::domain::group_chat::GroupChatSummary;

#[derive(Default)]
pub struct ChatList {
    chats: HashMap<ChatId, ChatEnum>,
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
        client_message_id: String,
        content: MessageContent,
        replies_to: Option<ReplyContext>,
        now: Timestamp) -> DirectChatSummary {

        self.add_message_to_stats(&content);
        let chat = DirectChat::new(chat_id, sender.clone(), recipient, client_message_id, content, replies_to, now);
        let chat_summary = DirectChatSummary::new(&chat, &sender, 0);

        self.chats.insert(chat_id, ChatEnum::Direct(chat));
        self.stats.direct_chat_count = self.stats.direct_chat_count + 1;
        chat_summary
    }

    pub fn create_group_chat(&mut self, creator: UserId, chat_id: ChatId, subject: String, participants: Vec<UserId>, now: Timestamp) -> Option<GroupChatSummary> {
        match self.chats.entry(chat_id) {
            Occupied(_) => None,
            Vacant(e) => {
                let chat = GroupChat::new(chat_id, subject, creator.clone(), participants, now);
                let chat_summary = GroupChatSummary::new(&chat, &creator, 0);

                e.insert(ChatEnum::Group(chat));
                self.stats.group_chat_count = self.stats.group_chat_count + 1;
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

    pub fn get_all(&self, me: &UserId) -> Vec<&ChatEnum> {
        // For now this will iterate through every chat...
        self
            .chats
            .values()
            .filter(|chat| chat.involves_user(me))
            .collect()
    }

    pub fn get_summaries(
        &self,
        user: &UserId,
        updated_since: Option<Timestamp>,
        message_count_for_top_chat: Option<u16>) -> Vec<ChatSummary> {

        let top_message_count = match message_count_for_top_chat {
            Some(c) => c as u32,
            None => 1
        };

        // For now this will iterate through every chat...
        let mut list: Vec<_> = self
            .chats
            .values()
            .filter(|chat| chat.involves_user(user))
            .filter(|chat| updated_since.is_none() || chat.get_updated_date() > updated_since.unwrap())
            .collect();

        list.sort_unstable_by(|c1, c2| {
            let t1 = c1.get_display_date(user);
            let t2 = c2.get_display_date(user);
            t2.cmp(&t1)
        });

        list
            .iter()
            .enumerate()
            .map(|(i, chat)| chat.to_summary(user, if i == 0 {top_message_count} else {1}))
            .collect()
    }

    pub fn delete_chat(&mut self, chat_id: ChatId) {
        if let Some(chat) = self.chats.remove(&chat_id) {
            match chat {
                ChatEnum::Direct(_) => self.stats.direct_chat_count = self.stats.direct_chat_count - 1,
                ChatEnum::Group(_) => self.stats.group_chat_count = self.stats.group_chat_count - 1,
            }
        }
    }

    pub fn push_message(&mut self, chat_id: ChatId, message_id: u32, is_blob: bool) {
        if is_blob {
            self.messages_to_prune.push_back((chat_id, message_id));
            self.stats.pruneable_message_count = self.stats.pruneable_message_count + 1;
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
            let messages: Vec<_> = self.messages_to_prune
                .drain(RangeTo { end: count_to_prune as usize })
                .collect();

            for (chat_id, message_id) in messages {
                if let Some(chat) = self.chats.get_mut(&chat_id) {
                    if let Some(message) = chat.get_message_mut(message_id) {
                        message.delete_blob_content(blob_storage);
                    }
                }
            }

            self.stats.pruneable_message_count = self.stats.pruneable_message_count - count_to_prune;
        }
    }

    pub fn get_stats(&self) -> Stats {
        self.stats.clone()
    }

    pub fn add_message_to_stats(&mut self, content: &MessageContent) {
        match content.get_type() {
            MessageContentType::Text => self.stats.text_message_count = self.stats.text_message_count + 1,
            MessageContentType::Image => self.stats.image_message_count = self.stats.image_message_count + 1,
            MessageContentType::Video => self.stats.video_message_count = self.stats.video_message_count + 1,
            MessageContentType::File => self.stats.file_message_count = self.stats.file_message_count + 1,
            MessageContentType::Cycles => {
                self.stats.cycles_message_count = self.stats.cycles_message_count + 1;
                if let MessageContent::Cycles(c) = content {
                    self.stats.cycles_transferred = self.stats.cycles_transferred + c.get_amount();
                }
            },
        }
    }
}

impl StableState for ChatList {
    type State = ChatListState;

    fn drain(self) -> ChatListState {
        let chats: Vec<ChatStableState> = self.chats
            .into_iter()
            .map(|(_, c)| c.into())
            .collect();
        let messages_to_prune: Vec<(ChatId, u32)> = self.messages_to_prune
            .into_iter()
            .collect();
        ChatListState {
            chats,
            messages_to_prune,
            stats: self.stats
        }
    }

    fn fill(state: ChatListState) -> ChatList {
        let chats_map: HashMap<ChatId, ChatEnum> = state.chats
            .into_iter()
            .map(|c| (c.get_id(), c.into()))
            .collect();
        let messages_to_prune_deque: VecDeque<(ChatId, u32)> = state.messages_to_prune
            .into_iter()
            .collect();
        ChatList {
            chats: chats_map,
            messages_to_prune: messages_to_prune_deque,
            stats: state.stats
        }
    }
}
