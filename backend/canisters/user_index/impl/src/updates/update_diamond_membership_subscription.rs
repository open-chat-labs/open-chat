use crate::guards::caller_is_openchat_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_index_canister::update_diamond_membership_subscription::{Response::*, *};

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
fn update_diamond_membership_subscription(args: Args) -> Response {
    mutate_state(|state| update_diamond_membership_subscription_impl(args, state))
}

fn update_diamond_membership_subscription_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    let user_id = state.data.users.get_by_principal(&caller).unwrap().user_id;
    let diamond_membership_details = state.data.users.diamond_membership_details_mut(&user_id).unwrap();

    if !diamond_membership_details.is_active(now) {
        NotDiamondMember
    } else if diamond_membership_details.is_lifetime_diamond_member() {
        AlreadyLifetimeDiamondMember
    } else {
        if let Some(pay_in_chat) = args.pay_in_chat {
            diamond_membership_details.set_pay_in_chat(pay_in_chat);
        }
        if let Some(subscription) = args.subscription {
            diamond_membership_details.set_subscription(subscription);
        }
        Success
    }
}
