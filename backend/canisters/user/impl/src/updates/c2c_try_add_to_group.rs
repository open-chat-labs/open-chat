use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_try_add_to_group::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_try_add_to_group(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_try_add_to_group_impl(args, state))
}

fn c2c_try_add_to_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.suspended.value {
        UserSuspended
    } else if runtime_state.data.blocked_users.contains(&args.added_by) {
        Blocked
    } else {
        let chat_id = runtime_state.env.caller().into();
        let now = runtime_state.env.now();

        runtime_state.data.group_chats.join(chat_id, args.latest_message_index, now);

        runtime_state.data.hot_group_exclusions.remove(&chat_id, now);

        Success(SuccessResult {
            principal: runtime_state.data.owner,
        })
    }
}
