use crate::guards::caller_is_group_index;
use crate::{mutate_state, openchat_bot, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_group_deleted::{Response::*, *};

#[update_msgpack(guard = "caller_is_group_index")]
#[trace]
fn c2c_notify_group_deleted(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_group_deleted_impl(args, state))
}

fn c2c_notify_group_deleted_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let chat_id = args.deleted_group.id;
    state.data.group_chats.remove(chat_id, now);

    if let Some(cached_groups) = &mut state.data.cached_group_summaries {
        cached_groups.remove_group(&chat_id);
    }

    openchat_bot::send_group_deleted_message(
        args.deleted_group.deleted_by,
        args.deleted_group.group_name,
        args.deleted_group.public,
        state,
    );

    Success
}
