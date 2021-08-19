use shared::chat_id::ChatId;
use shared::user_id::UserId;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{HashMap, HashSet};

#[derive(Default)]
pub struct UserToChatsMap {
    map: HashMap<UserId, HashSet<ChatId>>,
}

impl UserToChatsMap {
    pub fn get_chats(&self, user_id: &UserId) -> Option<&HashSet<ChatId>> {
        self.map.get(user_id)
    }

    pub fn link_chat_to_user(&mut self, chat_id: ChatId, user_id: UserId) -> bool {
        match self.map.entry(user_id) {
            Occupied(e) => e.into_mut().insert(chat_id),
            Vacant(e) => {
                let mut hs = HashSet::new();
                hs.insert(chat_id);
                e.insert(hs);
                true
            }
        }
    }

    pub fn unlink_chat_from_user(&mut self, chat_id: &ChatId, user_id: &UserId) -> bool {
        if let Some(hs) = self.map.get_mut(user_id) {
            hs.remove(chat_id)
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use itertools::Itertools;
    use std::str::FromStr;

    #[test]
    fn link_then_get_all_should_return_chats() {
        let mut map = UserToChatsMap::default();
        let user_id =
            UserId::from_str("bngem-gzprz-dtr6o-xnali-fgmfi-fjgpb-rya7j-x2idk-3eh6u-4v7tx-hqe")
                .unwrap();

        for c in (0..10).map(|i| ChatId(i)) {
            map.link_chat_to_user(c, user_id.clone());
        }

        let chats = map.get_chats(&user_id).unwrap();

        let sorted: Vec<_> = chats.iter().map(|c| c.0).sorted().collect();
        assert_eq!(10, sorted.len());
        for i in 0..10 {
            assert_eq!(i, sorted[i] as usize);
        }
    }

    #[test]
    fn unlink_then_get_all_should_not_return_unlinked_chats() {
        let mut map = UserToChatsMap::default();
        let user_id =
            UserId::from_str("bngem-gzprz-dtr6o-xnali-fgmfi-fjgpb-rya7j-x2idk-3eh6u-4v7tx-hqe")
                .unwrap();

        for c in (0..10).map(|i| ChatId(i)) {
            map.link_chat_to_user(c, user_id.clone());
        }

        for c in (5..10).map(|i| ChatId(i)) {
            map.unlink_chat_from_user(&c, &user_id);
        }

        let chats = map.get_chats(&user_id).unwrap();

        let sorted: Vec<_> = chats.iter().map(|c| c.0).sorted().collect();
        assert_eq!(5, sorted.len());
        for i in 0..5 {
            assert_eq!(i, sorted[i] as usize);
        }
    }
}
