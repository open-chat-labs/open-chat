use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use types::{Chat, TimestampMillis, Timestamped, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct FavouriteChats {
    chats: Timestamped<Vec<Chat>>,
    pinned: Timestamped<HashMap<Chat, TimestampMillis>>,
}

impl FavouriteChats {
    // Moves the user's chat with themselves, which is identified by their id, onto their new id once
    // they are migrated to a MultiUser canister
    pub fn migrate_own_user_id(&mut self, old_user_id: UserId, new_user_id: UserId) {
        let old_chat = Chat::Direct(old_user_id.into());
        let new_chat = Chat::Direct(new_user_id.into());
        for chat in self.chats.value.iter_mut().filter(|c| **c == old_chat) {
            *chat = new_chat;
        }
        if let Some(pinned_at) = self.pinned.value.remove(&old_chat) {
            self.pinned.value.insert(new_chat, pinned_at);
        }
    }

    pub fn add(&mut self, chat: Chat, now: TimestampMillis) -> bool {
        if !self.chats.value.contains(&chat) {
            self.chats.timestamp = now;
            self.chats.value.insert(0, chat);
            true
        } else {
            false
        }
    }

    pub fn remove(&mut self, chat: &Chat, now: TimestampMillis) -> bool {
        self.unpin(chat, now);

        if self.chats.value.contains(chat) {
            self.chats.timestamp = now;
            self.chats.value.retain(|c| c != chat);
            true
        } else {
            false
        }
    }

    pub fn pin(&mut self, chat: Chat, now: TimestampMillis) -> bool {
        if !self.pinned.value.contains_key(&chat) {
            self.pinned.timestamp = now;
            self.pinned.value.insert(chat, now);
            self.add(chat, now);
            true
        } else {
            false
        }
    }

    pub fn unpin(&mut self, chat: &Chat, now: TimestampMillis) -> bool {
        if self.pinned.value.contains_key(chat) {
            self.pinned.timestamp = now;
            self.pinned.value.remove(chat);
            true
        } else {
            false
        }
    }

    pub fn any_updated(&self, since: TimestampMillis) -> bool {
        self.chats.timestamp > since || self.pinned.timestamp > since
    }

    pub fn chats(&self) -> &Vec<Chat> {
        &self.chats.value
    }

    pub fn pinned(&self) -> &HashMap<Chat, TimestampMillis> {
        &self.pinned.value
    }

    pub fn chats_if_updated(&self, since: TimestampMillis) -> Option<Vec<Chat>> {
        self.chats.if_set_after(since).map(|ids| ids.to_vec())
    }

    pub fn pinned_if_updated(&self, since: TimestampMillis) -> Option<HashMap<Chat, TimestampMillis>> {
        self.pinned.if_set_after(since).map(|ids| ids.to_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    #[test]
    fn self_chat_is_moved_onto_the_new_id() {
        let mut favourites = FavouriteChats::default();
        let self_chat = Chat::Direct(user_id(1).into());
        let other_chat = Chat::Direct(user_id(2).into());
        favourites.add(self_chat, 1);
        favourites.add(other_chat, 2);
        favourites.pin(self_chat, 3);

        favourites.migrate_own_user_id(user_id(1), user_id(3));

        let new_self_chat = Chat::Direct(user_id(3).into());
        assert_eq!(favourites.chats.value, vec![other_chat, new_self_chat]);
        assert_eq!(favourites.pinned.value, HashMap::from([(new_self_chat, 3)]));
    }
}
