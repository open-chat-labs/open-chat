use crate::guards::caller_is_owner;
use crate::model::premium_items::PremiumItems;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use oc_error_codes::OCErrorCode;
use types::{ChitEvent, ChitEventType, PremiumItemPurchase};
use user_canister::pay_for_premium_item::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn pay_for_premium_item(args: Args) -> Response {
    execute_update(|state| pay_for_premium_item_impl(args, state))
}

fn pay_for_premium_item_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.premium_items.contains(&args.item_id) {
        return Error(OCErrorCode::AlreadyAdded.into());
    }

    let Some(cost) = PremiumItems::cost_in_chit(args.item_id) else {
        return Error(OCErrorCode::ItemNotFound.into());
    };

    if cost != args.expected_cost {
        return Error(OCErrorCode::PriceMismatch.into());
    }

    let chit_balance = state.data.chit_events.chit_balance();
    if chit_balance < (cost as i32) {
        return Error(OCErrorCode::InsufficientFunds.with_message(chit_balance));
    }

    let now = state.env.now();
    state.data.premium_items.add(args.item_id, cost, now);
    state.data.chit_events.push(ChitEvent {
        timestamp: now,
        amount: -(cost as i32),
        reason: ChitEventType::PurchasedPremiumItem(args.item_id),
    });

    state.notify_user_index_of_chit(now);
    state.push_local_user_index_canister_event(
        LocalUserIndexEvent::NotifyPremiumItemPurchased(PremiumItemPurchase {
            timestamp: now,
            item_id: args.item_id,
            paid_in_chat: false,
            cost,
        }),
        now,
    );

    Success(SuccessResult {
        total_chit_earned: state.data.chit_events.total_chit_earned(),
        chit_balance: state.data.chit_events.chit_balance(),
    })
}
