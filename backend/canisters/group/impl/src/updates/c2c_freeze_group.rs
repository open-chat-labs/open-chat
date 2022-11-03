use crate::guards::caller_is_group_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_freeze_group::{Response::*, *};
use types::FrozenGroupInfo;

#[update_msgpack(guard = "caller_is_group_index")]
#[trace]
async fn c2c_freeze_group(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_freeze_group_impl(args, state))
}

fn c2c_freeze_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.frozen.is_none() {
        let now = runtime_state.env.now();

        runtime_state.data.frozen = Some(FrozenGroupInfo {
            timestamp: now,
            frozen_by: args.caller,
            reason: args.reason,
        });
        runtime_state.data.events.mark_frozen(true);

        Success
    } else {
        AlreadyFrozen
    }
}
