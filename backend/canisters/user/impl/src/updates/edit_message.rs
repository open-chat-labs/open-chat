use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{EditMessageArgs, EditMessageResult};
use ic_cdk_macros::update;
use types::EventIndex;
use user_canister::edit_message_v2::{Response::*, *};
use user_canister::{c2c_edit_message, UserCanisterEvent};
use utils::consts::OPENCHAT_BOT_USER_ID;

#[update(guard = "caller_is_owner")]
#[trace]
fn edit_message_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| edit_message_impl(args, state))
}

fn edit_message_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return UserSuspended;
    }

    if state.data.blocked_users.contains(&args.user_id) {
        UserBlocked
    } else if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();

        let edit_message_args = EditMessageArgs {
            sender: my_user_id,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: None,
            message_id: args.message_id,
            content: args.content.clone(),
            now,
        };

        match chat.events.edit_message(edit_message_args) {
            EditMessageResult::Success => {
                if args.user_id != OPENCHAT_BOT_USER_ID {
                    state.push_user_canister_event(
                        args.user_id.into(),
                        UserCanisterEvent::EditMessage(Box::new(c2c_edit_message::Args {
                            message_id: args.message_id,
                            content: args.content.into(),
                            correlation_id: args.correlation_id,
                        })),
                    );
                }
                Success
            }
            EditMessageResult::NotAuthorized => MessageNotFound,
            EditMessageResult::NotFound => MessageNotFound,
        }
    } else {
        ChatNotFound
    }
}
