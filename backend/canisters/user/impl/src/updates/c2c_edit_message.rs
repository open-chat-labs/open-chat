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

    mutate_state(|state| c2c_edit_message_impl(args, state.env.caller().into(), state))
}

pub(crate) fn c2c_edit_message_impl(args: Args, caller_user_id: UserId, state: &mut RuntimeState) -> Response {
    if state.data.blocked_users.contains(&caller_user_id) {
        return UserBlocked;
    }

    if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
        let now = state.env.now();

        let edit_message_args = EditMessageArgs {
            sender: caller_user_id,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: None,
            message_id: args.message_id,
            content: args.content.into(),
            now,
        };

        // TODO: This should just take/edit text
        match chat.events.edit_message(edit_message_args) {
            EditMessageResult::Success => Success,
            EditMessageResult::NotAuthorized => MessageNotFound,
            EditMessageResult::NotFound => MessageNotFound,
        }
    } else {
        ChatNotFound
    }
}
