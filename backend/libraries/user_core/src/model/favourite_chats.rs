use std::collections::HashMap;

use constants::MAX_FAVOURITE_CHATS;
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use types::{Chat, OCResult, TimestampMillis, Timestamped};

#[derive(Serialize, Deserialize, Default)]
pub struct FavouriteChats {
    chats: Timestamped<Vec<Chat>>,
    pinned: Timestamped<HashMap<Chat, TimestampMillis>>,
}

impl FavouriteChats {
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
    use types::UserId;

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
}
