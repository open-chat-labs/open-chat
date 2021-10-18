use crate::updates::handle_activity_notification;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use chat_events::{EditMessageArgs, EditMessageResult};
use group_canister::edit_message::{Response::*, *};
use ic_cdk_macros::update;
use tracing::instrument;

#[update]
#[instrument(level = "trace")]
fn edit_message(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| edit_message_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn edit_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();
        let sender = participant.user_id;

        let edit_message_args = EditMessageArgs {
            sender,
            message_id: args.message_id,
            content: args.content,
            now,
        };

        match runtime_state.data.events.edit_message(edit_message_args) {
            EditMessageResult::Success => {
                runtime_state.data.accumulated_metrics.total_edits += 1;
                handle_activity_notification(runtime_state);
                Success
            }
            EditMessageResult::NotAuthorized => MessageNotFound,
            EditMessageResult::NotFound => MessageNotFound,
        }
    } else {
        CallerNotInGroup
    }
}
