use super::push_subscription::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::events::{Event, Subscription};
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::update;

type Args = Subscription;

#[derive(CandidType)]
enum Response {
    Success,
}

#[update]
fn push_subscription(args: Args) -> Response {
    RUNTIME_STATE.with(|state| push_subscription_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn push_subscription_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.events.add(Event::Subscription(args));
    Success
}
