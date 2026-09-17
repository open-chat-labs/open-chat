use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use user_canister::mark_read::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn mark_read(args: Args) -> Response {
    mutate_state(|state| mark_read_impl(args, state))
}

fn mark_read_impl(args: Args, state: &mut RuntimeState) -> Response {
    let my_index = state.caller_user_index_or_trap();
    let my_user_id = state.user_id(my_index);
    let now = state.env.now();

    for chat_messages_read in args.messages_read {
        // TODO: Group chats, once they are held per user
        let Some(read_up_to) = chat_messages_read.read_up_to else {
            continue;
        };

        // A chat the user doesn't have is skipped, as in the User canister. If the read position
        // moved, `read_up_to_of_theirs` is how far the user has read in the other user's copy of
        // the chat, which has its own message indexes.
        let read_up_to_of_theirs = state
            .with_direct_chat_mut(my_index, chat_messages_read.chat_id, |chat| {
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
            && let Some(their_index) = state.local_user_index(chat_messages_read.chat_id.into())
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

    // TODO: Community messages read, once communities are held per user

    Response::Success
}
