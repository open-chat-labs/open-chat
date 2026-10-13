use crate::User;
use multi_user_canister::ChatInList;
use multi_user_canister::unpin_chat_v2::Args;
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampMillis};
use utils::migrated_user_ids::MigratedUserIds;

// A direct chat is unpinned under both the id given and the id the chat is under now (see
// `pin_chat_v2`), since a pin can still be under an id the other user had before being migrated to
// a MultiUser canister until the `migrate_their_user_ids` job reaches the user
pub fn unpin_chat_v2(user: &mut User, args: Args, migrated_user_ids: &MigratedUserIds, now: TimestampMillis) -> OCResult {
    match args.chat {
        ChatInList::Direct(chat_id) => {
            let latest = user.direct_chats.latest_user_id(chat_id.into(), migrated_user_ids).into();
            user.direct_chats.unpin(&chat_id, now);
            user.direct_chats.unpin(&latest, now);
        }
        ChatInList::Group(chat_id) => {
            user.group_chats.unpin(&chat_id, now);
        }
        ChatInList::Favourite(chat) => {
            let latest = user.direct_chats.latest_chat(chat, migrated_user_ids);
            user.favourite_chats.unpin(&chat, now);
            user.favourite_chats.unpin(&latest, now);
        }
        ChatInList::Community(community_id, channel_id) => {
            let mut community = user.communities.get_mut(&community_id).ok_or(OCErrorCode::ChatNotFound)?;
            community.unpin(&channel_id, now);
        }
    }
    Ok(())
}
