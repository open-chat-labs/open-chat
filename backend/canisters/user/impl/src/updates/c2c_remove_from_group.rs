use crate::{mutate_state, openchat_bot, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_remove_from_group::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_remove_from_group(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_remove_from_group_impl(args, state))
}

fn c2c_remove_from_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let chat_id = runtime_state.env.caller().into();
    let now = runtime_state.env.now();

    if runtime_state.data.group_chats.remove(chat_id, now).is_some() {
        runtime_state.data.hot_group_exclusions.add(chat_id, None, now);

        if let Some(cached_groups) = &mut runtime_state.data.cached_group_summaries {
            cached_groups.remove_group(&chat_id);
        }

        openchat_bot::send_removed_from_group_message(
            args.removed_by,
            args.group_name,
            args.public,
            args.blocked,
            runtime_state,
        );
    }
    Success
}
