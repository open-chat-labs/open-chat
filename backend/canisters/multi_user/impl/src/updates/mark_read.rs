use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::mark_read::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn mark_read(args: Args) -> Response {
    mutate_state(|state| mark_read_impl(args, state))
}

fn mark_read_impl(args: Args, state: &mut RuntimeState) -> Response {
    let my_index = state.caller_user_index_or_trap();
    let now = state.env.now();

    for chat_messages_read in args.messages_read {
        // TODO: Group chats, once they are held per user
        let Some(read_up_to) = chat_messages_read.read_up_to else {
            continue;
        };

        // A chat the user doesn't have is skipped, as in the User canister. The read position
        // moves in the chat's core, so for a shared core the other user sees it straight away.
        // TODO: For a core held by this user alone, with a user in another canister, that canister
        // needs telling how far the user has read, as the User canister does
        let _ = state.with_direct_chat_mut(my_index, chat_messages_read.chat_id, |mut chat| {
            if read_up_to <= chat.main_events_reader().latest_message_index().unwrap_or_default() {
                chat.mark_read_by_me_up_to(read_up_to, now);
            }
        });
    }

    // TODO: Community messages read, once communities are held per user

    Response::Success
}
