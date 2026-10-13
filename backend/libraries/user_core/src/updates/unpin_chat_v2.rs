use crate::User;
use multi_user_canister::ChatInList;
use multi_user_canister::unpin_chat_v2::Args;
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampMillis};
use utils::migrated_user_ids::MigratedUserIds;

// A direct chat is unpinned under every id it may be pinned under (see
// `DirectChats::ids_naming_chat`), since a pin can still be under an id the other user had before
// being migrated to a MultiUser canister until the `migrate_their_user_ids` job reaches the user
pub fn unpin_chat_v2(user: &mut User, args: Args, migrated_user_ids: &MigratedUserIds, now: TimestampMillis) -> OCResult {
    match args.chat {
        ChatInList::Direct(chat_id) => {
            for user_id in user.direct_chats.ids_naming_chat(chat_id.into(), migrated_user_ids) {
                user.direct_chats.unpin(&user_id.into(), now);
            }
        }
        ChatInList::Group(chat_id) => {
            user.group_chats.unpin(&chat_id, now);
        }
        ChatInList::Favourite(chat) => {
            for chat in user.direct_chats.chats_naming_chat(chat, migrated_user_ids) {
                user.favourite_chats.unpin(&chat, now);
            }
        }
        ChatInList::Community(community_id, channel_id) => {
            let mut community = user.communities.get_mut(&community_id).ok_or(OCErrorCode::ChatNotFound)?;
            community.unpin(&channel_id, now);
        }
    }
    Ok(())
}
