use crate::guards::caller_is_platform_operator;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{UserIndexToLocalUserIndexEvent, UserUpgradeConcurrencyChanged};
use tracing::info;
use user_index_canister::set_user_upgrade_concurrency::{Response::*, *};

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
async fn set_user_upgrade_concurrency(args: Args) -> Response {
    mutate_state(|state| set_user_upgrade_concurrency_impl(args, state))
}

fn set_user_upgrade_concurrency_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.push_event_to_all_local_user_indexes(
        UserIndexToLocalUserIndexEvent::UserUpgradeConcurrencyChanged(UserUpgradeConcurrencyChanged { value: args.value }),
        None,
    );

    info!("User upgrade concurrency set to {}", args.value);
    Success
}
