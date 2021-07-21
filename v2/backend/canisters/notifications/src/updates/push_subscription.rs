use super::push_subscription::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;

#[derive(Deserialize)]
struct Args {
    subscription: String,
}

#[derive(CandidType)]
enum Response {
    Success,
}

#[update]
fn push_subscription(args: Args) -> Response {
    RUNTIME_STATE.with(|state| push_subscription_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn push_subscription_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let user_id = runtime_state.env.caller().into();
    let now = runtime_state.env.now();
    runtime_state.data.subscriptions.push(user_id, args.subscription, now);
    Success
}
