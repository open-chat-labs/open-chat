use crate::{RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use notifications_canister::remove_subscriptions_for_user::{Response::*, *};

#[update]
#[trace]
fn remove_subscriptions_for_user(_args: Args) -> Response {
    RUNTIME_STATE.with(|state| remove_subscriptions_for_user_impl(state.borrow_mut().as_mut().unwrap()))
}

fn remove_subscriptions_for_user_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(user_id) = runtime_state.data.principal_to_user_id.get(&caller) {
        runtime_state.data.subscriptions.remove_all(*user_id);
    }
    Success
}
