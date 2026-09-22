use crate::User;
use oc_error_codes::OCErrorCode;
use types::{Chat, TimestampMillis, Timestamped};
use user_canister::archive_unarchive_chats::{Response::*, *};

pub fn archive_unarchive_chats(user: &mut User, args: Args, now: TimestampMillis) -> Response {
    let chats_to_update = args.to_archive.len() + args.to_unarchive.len();

    let to_archive = args.to_archive.into_iter().map(|chat| (chat, true));
    let to_unarchive = args.to_unarchive.into_iter().map(|chat| (chat, false));
    let chats_not_found: Vec<_> = to_archive
        .chain(to_unarchive)
        .filter(|(chat, archive)| !update_chat(user, chat, *archive, now))
        .map(|(chat, _)| chat)
        .collect();

    if chats_not_found.is_empty() {
        Success
    } else if chats_not_found.len() == chats_to_update {
        Error(OCErrorCode::NoChange.into())
    } else {
        PartialSuccess(PartialSuccessResult { chats_not_found })
    }
}

// Returns whether the chat was found. An archived chat is also unpinned.
fn update_chat(user: &mut User, chat: &Chat, archive: bool, now: TimestampMillis) -> bool {
    let found = match chat {
        Chat::Direct(chat_id) => match user.direct_chats.get_mut(chat_id) {
            Some(direct_chat) => {
                direct_chat.archived = Timestamped::new(archive, now);
                if archive {
                    user.direct_chats.unpin(chat_id, now);
                }
                true
            }
            None => false,
        },
        Chat::Group(chat_id) => match user.group_chats.get_mut(chat_id) {
            Some(group) => {
                group.archived = Timestamped::new(archive, now);
                if archive {
                    user.group_chats.unpin(chat_id, now);
                }
                true
            }
            None => false,
        },
        Chat::Channel(community_id, channel_id) => match user.communities.get_mut(community_id) {
            Some(community) => match community.channels.get_mut(channel_id) {
                Some(channel) => {
                    channel.archived = Timestamped::new(archive, now);
                    if archive {
                        community.unpin(channel_id, now);
                    }
                    true
                }
                None => false,
            },
            None => false,
        },
    };

    if found && archive {
        user.favourite_chats.unpin(chat, now);
    }

    found
}
