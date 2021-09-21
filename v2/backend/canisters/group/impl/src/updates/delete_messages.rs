use crate::updates::handle_activity_notification;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::delete_messages::{Response::*, *};
use ic_cdk_macros::update;

#[update]
fn delete_messages(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| delete_messages_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn delete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();

        for message_id in args.message_ids.into_iter() {
            runtime_state.data.events.delete_message(participant.user_id, message_id, now);
        }

        handle_activity_notification(runtime_state);

        Success
    } else {
        NotInGroup
    }
}
