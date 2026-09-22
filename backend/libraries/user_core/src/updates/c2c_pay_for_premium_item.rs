use crate::User;
use oc_error_codes::OCErrorCode;
use types::{ChitEvent, ChitEventType, OCResult, TimestampMillis};
use user_canister::c2c_pay_for_premium_item::{Args, SuccessResult};

// Spends the user's CHIT on the item. The caller tells the LocalUserIndex of the user's new CHIT
// balance on success.
pub fn c2c_pay_for_premium_item(user: &mut User, args: Args, now: TimestampMillis) -> OCResult<SuccessResult> {
    let chit_balance = user.chit_events.chit_balance();
    if chit_balance < (args.cost as i32) {
        return Err(OCErrorCode::InsufficientFunds.with_message(chit_balance));
    }

    if !user.premium_items.add(args.item_id, args.cost, now) {
        return Err(OCErrorCode::AlreadyAdded.into());
    }

    user.chit_events.push(ChitEvent {
        timestamp: now,
        amount: -(args.cost as i32),
        reason: ChitEventType::PurchasedPremiumItem(args.item_id),
    });

    Ok(SuccessResult {
        total_chit_earned: user.chit_events.total_chit_earned(),
        chit_balance: user.chit_events.chit_balance(),
    })
}
