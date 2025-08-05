use crate::guards::caller_is_openchat_user;
use crate::model::premium_items::PremiumItems;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_index_canister::pay_for_premium_item::{Response::*, *};

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
fn pay_for_premium_item(args: Args) -> Response {
    mutate_state(|state| pay_for_premium_item_impl(args, state))
}

fn pay_for_premium_item_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let user = state.data.users.get_mut(&caller).unwrap();

    if user.premium_items.contains(&args.item_id) {
        return Error(OCErrorCode::AlreadyAdded.into());
    }

    let Some(cost) = PremiumItems::cost_in_chit(args.item_id) else {
        return Error(OCErrorCode::ItemNotFound.into());
    };

    if cost != args.expected_cost {
        return Error(OCErrorCode::PriceMismatch.into());
    }

    let chit_balance = user.total_chit_earned - user.total_chit_spent;
    if chit_balance < (cost as i32) {
        return Error(OCErrorCode::InsufficientFunds.with_message(chit_balance));
    }

    let now = state.env.now();
    user.pay_for_premium_item(args.item_id, cost, now);
    state
        .data
        .premium_items
        .log_purchase(user.user_id, args.item_id, false, cost, now);

    Success(SuccessResult {
        total_chit_earned: user.total_chit_earned,
        chit_balance: user.total_chit_earned - user.total_chit_spent,
    })
}
