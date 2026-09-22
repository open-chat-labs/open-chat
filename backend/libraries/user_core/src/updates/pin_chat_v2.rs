use crate::User;
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampMillis};
use user_canister::ChatInList;
use user_canister::pin_chat_v2::Args;

// The caller awards the `PinnedChat` achievement on success
pub fn pin_chat_v2(user: &mut User, args: Args, now: TimestampMillis) -> OCResult {
    match args.chat {
        ChatInList::Direct(chat_id) => {
            user.direct_chats.pin(chat_id, now);
        }
        ChatInList::Group(chat_id) => {
            user.group_chats.pin(chat_id, now);
        }
        ChatInList::Favourite(chat) => {
            user.favourite_chats.pin(chat, now);
        }
        ChatInList::Community(community_id, channel_id) => {
            let community = user.communities.get_mut(&community_id).ok_or(OCErrorCode::ChatNotFound)?;
            community.pin(channel_id, now);
        }
    }
    Ok(())
}
