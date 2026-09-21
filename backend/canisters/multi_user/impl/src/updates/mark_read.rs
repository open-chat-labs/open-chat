use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use user_canister::mark_read::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn mark_read(args: Args) -> Response {
    mutate_state(|state| mark_read_impl(args, state))
}

fn mark_read_impl(args: Args, state: &mut RuntimeState) -> Response {
    let my_index = state.caller_user_index_or_trap();
    let my_user_id = state.user_id(my_index);
    let now = state.env.now();

    for ChatMessagesRead {
        chat_id,
        read_up_to,
        threads,
        date_read_pinned,
    } in args.messages_read
    {
        // A group is marked read in the user's own state, as in the User canister
        let is_group = state.with_caller_user_mut(|_, user| match user.group_chats.get_mut(&chat_id) {
            Some(group) => {
                group.mark_read(read_up_to, threads, date_read_pinned, now);
                true
            }
            None => false,
        });
        if is_group {
            continue;
        }

        let Some(read_up_to) = read_up_to else {
            continue;
        };

        // A chat the user doesn't have is skipped, as in the User canister. If the read position
        // moved, `read_up_to_of_theirs` is how far the user has read in the other user's copy of
        // the chat, which has its own message indexes.
        let read_up_to_of_theirs = state
            .with_direct_chat_mut(my_index, chat_id, |chat| {
                if read_up_to <= chat.main_events_reader().latest_message_index().unwrap_or_default()
                    && chat.mark_read_by_me_up_to(read_up_to, now)
                    && chat.them != OPENCHAT_BOT_USER_ID
                    && let Some(read_up_to_of_theirs) = chat.max_read_up_to_of_theirs(read_up_to)
                {
                    chat.remove_unread_message_indexes_up_to(read_up_to_of_theirs);
                    Some(read_up_to_of_theirs)
                } else {
                    None
                }
            })
            .ok()
            .flatten();

        // Tell the other user how far this user has read, which for a user in this canister means
        // updating their copy of the chat directly. As between User canisters, a user who has
        // blocked this one isn't told.
        // TODO: A user in another canister needs telling via `MarkMessagesRead`, as the User
        // canister does, once the MultiUser canister has a queue of events for other canisters
        if let Some(read_up_to_of_theirs) = read_up_to_of_theirs
            && let Some(their_index) = state.index_of_local_user(chat_id.into())
        {
            state.data.users.with_user_mut(their_index, |user| {
                if !user.blocked_users.contains(&my_user_id)
                    && let Some(chat) = user.direct_chats.get_mut(&my_user_id.into())
                {
                    chat.mark_read_by_them_up_to(read_up_to_of_theirs, now);
                }
            });
        }
    }

    state.with_caller_user_mut(|_, user| {
        for community_messages_read in args.community_messages_read {
            if let Some(community) = user.communities.get_mut(&community_messages_read.community_id) {
                community.mark_read(community_messages_read.channels_read, now);
            }
        }
    });

    Response::Success
}
