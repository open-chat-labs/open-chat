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

fn c2c_remove_from_group_impl(args: Args, state: &mut RuntimeState) -> Response {
    let chat_id = state.env.caller().into();
    let now = state.env.now();

    if state.data.group_chats.remove(chat_id, now).is_some() {
        state.data.hot_group_exclusions.add(chat_id, None, now);

        if let Some(cached_groups) = &mut state.data.cached_group_summaries {
            cached_groups.remove_group(&chat_id);
        }

        openchat_bot::send_removed_from_group_or_community_message(
            true,
            args.removed_by,
            args.group_name,
            args.public,
            args.blocked,
            state,
        );
    }
    Success
}
