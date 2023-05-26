use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::{EditMessageArgs, EditMessageResult};
use types::{EventIndex, UserId};
use user_canister::c2c_edit_message::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_edit_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_edit_message_impl(args, state))
}

fn c2c_edit_message_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller: UserId = state.env.caller().into();

    if state.data.blocked_users.contains(&caller) {
        return UserBlocked;
    }

    if let Some(chat) = state.data.direct_chats.get_mut(&caller.into()) {
        let now = state.env.now();

        let edit_message_args = EditMessageArgs {
            sender: caller,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: None,
            message_id: args.message_id,
            content: args.content.into(),
            now,
        };

        match chat.events.edit_message(edit_message_args) {
            EditMessageResult::Success => Success,
            EditMessageResult::NotAuthorized => MessageNotFound,
            EditMessageResult::NotFound => MessageNotFound,
        }
    } else {
        ChatNotFound
    }
}
