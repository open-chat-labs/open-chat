use crate::crypto::validate_from_account;
use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{OCResult, UserCanisterStreakInsurancePayment, UserId};
use user_canister::pay_for_streak_insurance::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn pay_for_streak_insurance(args: Args) -> Response {
    execute_update_async(|| pay_for_streak_insurance_impl(args)).await
}

async fn pay_for_streak_insurance_impl(mut args: Args) -> Response {
    let PrepareOk {
        my_user_id,
        days_currently_insured,
    } = match mutate_state(|state| prepare(&mut args, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    let transfer_result =
        user_core::updates::pay_for_streak_insurance::pay(my_user_id, args.from_account, args.expected_price).await;

    mutate_state(|state| {
        state.data.user.streak.release_payment_lock();

        match transfer_result {
            Ok(transaction_index) => {
                let now = state.env.now();
                state.mark_streak_insurance_payment(UserCanisterStreakInsurancePayment {
                    timestamp: now,
                    chat_amount: args.expected_price,
                    additional_days: args.additional_days,
                    new_days_insured: days_currently_insured + args.additional_days,
                    transaction_index,
                });
                Response::Success
            }
            Err(error) => Response::Error(error),
        }
    })
}

struct PrepareOk {
    my_user_id: UserId,
    days_currently_insured: u8,
}

fn prepare(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareOk> {
    let my_user_id: UserId = state.env.canister_id().into();
    validate_from_account(args.from_account, my_user_id)?;

    let now = state.env.now();
    let days_currently_insured = user_core::updates::pay_for_streak_insurance::prepare(&mut state.data.user, args, now)?;
    Ok(PrepareOk {
        my_user_id,
        days_currently_insured,
    })
}
