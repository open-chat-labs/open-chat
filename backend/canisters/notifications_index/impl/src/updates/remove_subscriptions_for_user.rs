use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use notifications_index_canister::remove_subscriptions_for_user::{Response::*, *};

#[update]
#[trace]
fn remove_subscriptions_for_user(_args: Args) -> Response {
    mutate_state(remove_subscriptions_for_user_impl)
}

fn remove_subscriptions_for_user_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(user_id) = runtime_state.data.principal_to_user_id.get(&caller) {
        runtime_state.remove_all_subscriptions(*user_id);
    }
    Success
}
