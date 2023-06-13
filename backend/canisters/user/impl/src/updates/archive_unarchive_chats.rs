use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{Chat, TimestampMillis, Timestamped};
use user_canister::archive_unarchive_chats::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn archive_unarchive_chats(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| {
        let now = state.env.now();
        let mut chats_not_found = Vec::new();

        for chat in args.to_archive {
            if !update_chat(&chat, true, now, state) {
                chats_not_found.push(chat);
            }
        }

        for chat in args.to_unarchive {
            if !update_chat(&chat, false, now, state) {
                chats_not_found.push(chat);
            }
        }

        Success
    })
}

fn update_chat(chat: &Chat, archive: bool, now: TimestampMillis, state: &mut RuntimeState) -> bool {
    // If archive also unpin the chat

    let success = match chat {
        Chat::Direct(chat_id) => {
            if let Some(dc) = state.data.direct_chats.get_mut(chat_id) {
                dc.archived = Timestamped::new(archive, now);

                if archive {
                    state.data.direct_chats.unpin(chat_id, now);
                }

                true
            } else {
                false
            }
        }
        Chat::Group(chat_id) => {
            if let Some(gc) = state.data.group_chats.get_mut(chat_id) {
                gc.archived = Timestamped::new(archive, now);

                if archive {
                    state.data.group_chats.unpin(chat_id, now);
                }

                true
            } else {
                false
            }
        }
        Chat::Channel(community_id, channel_id) => {
            if let Some(community) = state.data.communities.get_mut(community_id) {
                if let Some(channel) = community.channels.get_mut(channel_id) {
                    channel.archived = Timestamped::new(archive, now);

                    if archive {
                        community.unpin(channel_id, now);
                    }

                    true
                } else {
                    false
                }
            } else {
                false
            }
        }
    };

    if success && archive {
        state.data.favourite_chats.unpin(chat, now);
    }

    false
}
