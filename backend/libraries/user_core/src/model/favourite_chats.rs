use std::collections::HashMap;

use constants::MAX_FAVOURITE_CHATS;
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use types::{Chat, OCResult, TimestampMillis, Timestamped, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct FavouriteChats {
    chats: Timestamped<Vec<Chat>>,
    pinned: Timestamped<HashMap<Chat, TimestampMillis>>,
}

impl FavouriteChats {
    // Moves the user's chat with themselves, which is identified by their id, onto their new id once
    // they are migrated to a MultiUser canister
    pub fn migrate_own_user_id(&mut self, old_user_id: UserId, new_user_id: UserId) {
        self.move_direct_chat(old_user_id, new_user_id);
    }

    // Moves the user's chat with another user onto that user's new id once they are migrated to a
    // MultiUser canister
    pub fn migrate_their_user_id(&mut self, old_user_id: UserId, new_user_id: UserId, now: TimestampMillis) {
        let (chats_changed, pinned_changed) = self.move_direct_chat(old_user_id, new_user_id);
        if chats_changed {
            self.chats.timestamp = now;
        }
        if pinned_changed {
            self.pinned.timestamp = now;
        }
    }

    // Returns whether the favourites, then the pinned favourites, changed
    fn move_direct_chat(&mut self, old_user_id: UserId, new_user_id: UserId) -> (bool, bool) {
        let old_chat = Chat::Direct(old_user_id.into());
        let new_chat = Chat::Direct(new_user_id.into());
        let mut chats_changed = false;
        for chat in self.chats.value.iter_mut().filter(|c| **c == old_chat) {
            *chat = new_chat;
            chats_changed = true;
        }
        let pinned_changed = if let Some(pinned_at) = self.pinned.value.remove(&old_chat) {
            self.pinned.value.insert(new_chat, pinned_at);
            true
        } else {
            false
        };
        (chats_changed, pinned_changed)
    }

    // Adds the chat, provided fewer than `MAX_FAVOURITE_CHATS` are favourites, returning whether it
    // wasn't already one
    pub fn add(&mut self, chat: Chat, now: TimestampMillis) -> OCResult<bool> {
        if !self.chats.value.contains(&chat) && self.chats.value.len() >= MAX_FAVOURITE_CHATS {
            return Err(OCErrorCode::LimitReached.with_message(MAX_FAVOURITE_CHATS));
        }
        Ok(self.add_without_limit(chat, now))
    }

    // Adds the chat whatever the limit, for when the caller has already checked it or isn't adding
    // to the user's favourites, returning whether it wasn't already one
    pub fn add_without_limit(&mut self, chat: Chat, now: TimestampMillis) -> bool {
        if self.chats.value.contains(&chat) {
            return false;
        }
        self.chats.timestamp = now;
        self.chats.value.insert(0, chat);
        true
    }

    pub fn contains(&self, chat: &Chat) -> bool {
        self.chats.value.contains(chat)
    }

    pub fn len(&self) -> usize {
        self.chats.value.len()
    }

    pub fn is_empty(&self) -> bool {
        self.chats.value.is_empty()
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

    // Pins the chat, adding it to the favourites if it isn't one. Every pinned chat is a favourite, so
    // the pins are limited along with the favourites.
    pub fn pin(&mut self, chat: Chat, now: TimestampMillis) -> OCResult {
        if self.pinned.value.contains_key(&chat) {
            return Ok(());
        }
        self.add(chat, now)?;
        self.pinned.timestamp = now;
        self.pinned.value.insert(chat, now);
        Ok(())
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
    fn favourites_are_limited() {
        let mut favourites = FavouriteChats::default();
        for i in 0..MAX_FAVOURITE_CHATS as u8 {
            assert!(favourites.add(Chat::Direct(user_id(i).into()), 1).unwrap());
        }
        // Adding one which is already a favourite is fine, but no more can be added
        assert!(!favourites.add(Chat::Direct(user_id(0).into()), 2).unwrap());
        let extra = Chat::Direct(user_id(MAX_FAVOURITE_CHATS as u8).into());
        let error = favourites.add(extra, 2).unwrap_err();
        assert!(error.matches_code(OCErrorCode::LimitReached), "{error:?}");
        // Nor can one be pinned, since pinning adds it to the favourites
        assert!(favourites.pin(extra, 3).unwrap_err().matches_code(OCErrorCode::LimitReached));
        assert!(!favourites.pinned.value.contains_key(&extra));

        // Removing a favourite makes room for another
        favourites.remove(&Chat::Direct(user_id(0).into()), 4);
        favourites.pin(extra, 5).unwrap();
        assert!(favourites.chats.value.contains(&extra));
    }

    #[test]
    fn self_chat_is_moved_onto_the_new_id() {
        let mut favourites = FavouriteChats::default();
        let self_chat = Chat::Direct(user_id(1).into());
        let other_chat = Chat::Direct(user_id(2).into());
        favourites.add(self_chat, 1).unwrap();
        favourites.add(other_chat, 2).unwrap();
        favourites.pin(self_chat, 3).unwrap();

        favourites.migrate_own_user_id(user_id(1), user_id(3));

        let new_self_chat = Chat::Direct(user_id(3).into());
        assert_eq!(favourites.chats.value, vec![other_chat, new_self_chat]);
        assert_eq!(favourites.pinned.value, HashMap::from([(new_self_chat, 3)]));
    }

    #[test]
    fn chat_with_a_migrated_user_is_moved_onto_their_new_id() {
        let mut favourites = FavouriteChats::default();
        let chat = Chat::Direct(user_id(2).into());
        let other_chat = Chat::Direct(user_id(4).into());
        favourites.add(chat, 1).unwrap();
        favourites.add(other_chat, 2).unwrap();
        favourites.pin(chat, 3).unwrap();

        favourites.migrate_their_user_id(user_id(2), user_id(5), 10);

        let new_chat = Chat::Direct(user_id(5).into());
        assert_eq!(favourites.chats.value, vec![other_chat, new_chat]);
        assert_eq!(favourites.pinned.value, HashMap::from([(new_chat, 3)]));
        // Clients are sent the favourites again
        assert!(favourites.any_updated(9));

        // Nothing changes for a user who isn't a favourite
        favourites.migrate_their_user_id(user_id(6), user_id(7), 20);
        assert!(!favourites.any_updated(10));
    }
}
