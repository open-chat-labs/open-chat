use crate::User;
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampMillis};
use user_canister::ChatInList;
use user_canister::unpin_chat_v2::Args;

pub fn unpin_chat_v2(user: &mut User, args: Args, now: TimestampMillis) -> OCResult {
    match args.chat {
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
            let community = user.communities.get_mut(&community_id).ok_or(OCErrorCode::ChatNotFound)?;
            community.unpin(&channel_id, now);
        }
    }
    Ok(())
}
