use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::mark_read::{Response::*, *};
use user_canister::{MarkMessagesReadArgs, UserCanisterEvent};
use utils::consts::OPENCHAT_BOT_USER_ID;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn mark_read(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| mark_read_impl(args, state))
}

fn mark_read_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    for chat_messages_read in args.messages_read {
        if let Some(group_chat) = state.data.group_chats.get_mut(&chat_messages_read.chat_id) {
            group_chat.mark_read(
                chat_messages_read.read_up_to,
                chat_messages_read.threads,
                chat_messages_read.date_read_pinned,
                now,
            );
        } else if let Some(direct_chat) = state.data.direct_chats.get_mut(&chat_messages_read.chat_id) {
            if let Some(read_up_to) = chat_messages_read.read_up_to {
                if read_up_to
                    <= direct_chat
                        .events
                        .main_events_reader()
                        .latest_message_index()
                        .unwrap_or_default()
                    && direct_chat.mark_read_up_to(read_up_to, true, now)
                    && direct_chat.them != OPENCHAT_BOT_USER_ID
                {
                    if let Some(read_up_to_of_theirs) =
                        direct_chat.unread_message_index_map.get_max_read_up_to_of_theirs(&read_up_to)
                    {
                        direct_chat.unread_message_index_map.remove_up_to(read_up_to_of_theirs);

                        state.push_user_canister_event(
                            chat_messages_read.chat_id.into(),
                            UserCanisterEvent::MarkMessagesRead(MarkMessagesReadArgs {
                                read_up_to: read_up_to_of_theirs,
                            }),
                        );
                    }
                }
            }
        }
    }

    for community_messages_read in args.community_messages_read {
        if let Some(community) = state.data.communities.get_mut(&community_messages_read.community_id) {
            community.mark_read(community_messages_read.channels_read, now);
        }
    }

    Success
}
