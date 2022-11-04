use crate::guards::caller_is_group_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_unfreeze_group::{Response::*, *};
use types::Timestamped;

#[update_msgpack(guard = "caller_is_group_index")]
#[trace]
async fn c2c_unfreeze_group(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_unfreeze_group_impl(args, state))
}

fn c2c_unfreeze_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.frozen.is_some() {
        let now = runtime_state.env.now();

        runtime_state.data.events.unfreeze(args.caller, now);
        runtime_state.data.frozen = Timestamped::new(None, now);

        Success
    } else {
        AlreadyFrozen
    }
}
