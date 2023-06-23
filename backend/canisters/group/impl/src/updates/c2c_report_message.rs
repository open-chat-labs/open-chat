use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_report_message::{Response::*, *};
use group_canister::c2c_report_message_v2;
use types::MultiUserChat;

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
fn c2c_report_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| {
        c2c_report_message_impl(
            c2c_report_message_v2::Args {
                user_id: args.user_id,
                chat_id: MultiUserChat::Group(args.chat_id),
                thread_root_message_index: args.thread_root_message_index,
                event_index: args.event_index,
                reason_code: args.reason_code,
                notes: args.notes,
            },
            state,
        )
    })
}

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
fn c2c_report_message_v2(args: c2c_report_message_v2::Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_report_message_impl(args, state))
}

fn c2c_report_message_impl(args: c2c_report_message_v2::Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    state.data.chat.events.report_message(
        args.user_id,
        args.chat_id,
        args.thread_root_message_index,
        args.event_index,
        args.reason_code,
        args.notes,
        now,
    );

    handle_activity_notification(state);
    Success
}
