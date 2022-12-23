use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use notifications_index_canister::remove_subscription::{Response::*, *};

#[update]
#[trace]
fn remove_subscription(args: Args) -> Response {
    mutate_state(|state| remove_subscription_impl(args, state))
}

fn remove_subscription_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(user_id) = runtime_state.data.principal_to_user_id.get(&caller) {
        runtime_state.remove_subscription(*user_id, args.p256dh_key);
    }
    Success
}
