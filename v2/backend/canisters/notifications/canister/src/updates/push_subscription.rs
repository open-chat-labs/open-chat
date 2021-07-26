use super::push_subscription::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use crate::model::subscription::SubscriptionInfo;
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;
use shared::types::UserId;

#[derive(Deserialize)]
struct Args {
    user_id: UserId,
    subscription: SubscriptionInfo,
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
    let now = runtime_state.env.now();
    runtime_state.data.subscriptions.push(args.user_id, args.subscription, now);
    Success
}
