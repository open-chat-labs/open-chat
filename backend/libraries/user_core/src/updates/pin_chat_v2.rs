use crate::User;
use multi_user_canister::ChatInList;
use multi_user_canister::pin_chat_v2::Args;
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampMillis};
use utils::migrated_user_ids::MigratedUserIds;

// The caller awards the `PinnedChat` achievement on success
pub fn pin_chat_v2(user: &mut User, args: Args, migrated_user_ids: &MigratedUserIds, now: TimestampMillis) -> OCResult {
    match latest_chat_in_list(user, args.chat, migrated_user_ids) {
        ChatInList::Direct(chat_id) => user.direct_chats.pin(chat_id, now),
        ChatInList::Group(chat_id) => user.group_chats.pin(chat_id, now),
        ChatInList::Favourite(chat) => user.favourite_chats.pin(chat, now),
        ChatInList::Community(community_id, channel_id) => user
            .communities
            .get_mut(&community_id)
            .ok_or(OCErrorCode::ChatNotFound)?
            .pin(channel_id, now),
    }
}

// A client which hasn't yet heard that the other user in a direct chat has been migrated to a
// MultiUser canister names the chat by their old id, so a direct chat is named by the id the chat
// is under now (see `DirectChats::latest_user_id`), so that it isn't pinned under an old id
pub(crate) fn latest_chat_in_list(user: &User, chat: ChatInList, migrated_user_ids: &MigratedUserIds) -> ChatInList {
    match chat {
        ChatInList::Direct(chat_id) => {
            ChatInList::Direct(user.direct_chats.latest_user_id(chat_id.into(), migrated_user_ids).into())
        }
        ChatInList::Favourite(chat) => ChatInList::Favourite(user.direct_chats.latest_chat(chat, migrated_user_ids)),
        chat => chat,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::updates::unpin_chat_v2;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use std::collections::HashMap;
    use types::{Chat, UserId, UserType};

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    #[test]
    fn direct_chats_named_by_an_old_id_are_pinned_and_unpinned_under_the_id_the_chat_is_under() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
        let mut user = User::new(Principal::from_slice(&[1]), "user".to_string(), None, 0);
        let mut migrated_user_ids = MigratedUserIds::default();
        migrated_user_ids.insert(user_id(2), user_id(3));
        migrated_user_ids.insert(user_id(4), user_id(5));
        // A chat left under the old id
        user.direct_chats
            .get_or_create(user_id(1), user_id(4), UserType::User, || 1, 0);
        let direct = |i: u8| ChatInList::Direct(user_id(i).into());
        let favourite = |i: u8| ChatInList::Favourite(Chat::Direct(user_id(i).into()));

        for chat in [direct(2), direct(4), favourite(2)] {
            pin_chat_v2(&mut user, Args { chat }, &migrated_user_ids, 10).unwrap();
        }

        assert_eq!(
            user.direct_chats.pinned_chats(),
            HashMap::from([(Chat::Direct(user_id(3).into()), 10), (Chat::Direct(user_id(4).into()), 10)])
        );
        assert_eq!(user.favourite_chats.chats(), &[Chat::Direct(user_id(3).into())]);

        for chat in [direct(2), favourite(2)] {
            let args = multi_user_canister::unpin_chat_v2::Args { chat };
            unpin_chat_v2(&mut user, args, &migrated_user_ids, 20).unwrap();
        }
        assert_eq!(
            user.direct_chats.pinned_chats(),
            HashMap::from([(Chat::Direct(user_id(4).into()), 10)])
        );
        assert!(user.favourite_chats.pinned().is_empty());
    }
}
