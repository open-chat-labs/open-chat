use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use group_canister::delete_messages::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn delete_messages(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| delete_messages_impl(args, state))
}

fn delete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();

        for message_id in args.message_ids {
            runtime_state.data.events.delete_message(
                participant.user_id,
                participant.role.can_delete_messages(),
                message_id,
                now,
            );
        }

        handle_activity_notification(runtime_state);

        Success
    } else {
        CallerNotInGroup
    }
}
