use crate::guards::caller_is_platform_operator;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::{Event, UserUpgradeConcurrencyChanged};
use tracing::info;
use user_index_canister::set_user_upgrade_concurrency::{Response::*, *};

#[update(guard = "caller_is_platform_operator")]
#[trace]
async fn set_user_upgrade_concurrency(args: Args) -> Response {
    mutate_state(|state| set_user_upgrade_concurrency_impl(args, state))
}

fn set_user_upgrade_concurrency_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.push_event_to_all_local_user_indexes(
        Event::UserUpgradeConcurrencyChanged(UserUpgradeConcurrencyChanged { value: args.value }),
        None,
    );
    crate::jobs::sync_events_to_local_user_index_canisters::start_job_if_required(runtime_state);

    info!("User upgrade concurrency set to {}", args.value);
    Success
}
