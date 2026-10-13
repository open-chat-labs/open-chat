use crate::User;
use crate::updates::pin_chat_v2::latest_chat_in_list;
use multi_user_canister::ChatInList;
use multi_user_canister::unpin_chat_v2::Args;
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampMillis};
use utils::migrated_user_ids::MigratedUserIds;

pub fn unpin_chat_v2(user: &mut User, args: Args, migrated_user_ids: &MigratedUserIds, now: TimestampMillis) -> OCResult {
    match latest_chat_in_list(user, args.chat, migrated_user_ids) {
        ChatInList::Direct(chat_id) => {
            user.direct_chats.unpin(&chat_id, now);
        }
        ChatInList::Group(chat_id) => {
            user.group_chats.unpin(&chat_id, now);
        }
        ChatInList::Favourite(chat) => {
            user.favourite_chats.unpin(&chat, now);
        }
        ChatInList::Community(community_id, channel_id) => {
            let mut community = user.communities.get_mut(&community_id).ok_or(OCErrorCode::ChatNotFound)?;
            community.unpin(&channel_id, now);
        }
    }
    Ok(())
}
