use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{ChitEvent, ChitEventType};
use user_canister::c2c_pay_for_premium_item::{Response::*, *};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_pay_for_premium_item(args: Args) -> Response {
    execute_update(|state| c2c_pay_for_premium_item_impl(args, state))
}

fn c2c_pay_for_premium_item_impl(args: Args, state: &mut RuntimeState) -> Response {
    let chit_balance = state.data.chit_events.chit_balance();
    if chit_balance < (args.cost as i32) {
        return Error(OCErrorCode::InsufficientFunds.with_message(chit_balance));
    }

    let now = state.env.now();
    if !state.data.premium_items.add(args.item_id, args.cost, now) {
        return Error(OCErrorCode::AlreadyAdded.into());
    }

    state.data.chit_events.push(ChitEvent {
        timestamp: now,
        amount: -(args.cost as i32),
        reason: ChitEventType::PurchasedPremiumItem(args.item_id),
    });

    state.notify_user_index_of_chit(now);

    Success(SuccessResult {
        total_chit_earned: state.data.chit_events.total_chit_earned(),
        chit_balance: state.data.chit_events.chit_balance(),
    })
}
