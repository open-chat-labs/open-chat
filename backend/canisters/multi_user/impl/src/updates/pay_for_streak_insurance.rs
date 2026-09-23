use crate::crypto::validate_from_account;
use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{OCResult, UserCanisterStreakInsurancePayment};
use user_canister::pay_for_streak_insurance::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn pay_for_streak_insurance(mut args: Args) -> Response {
    let PrepareOk {
        my_index,
        days_currently_insured,
    } = match mutate_state(|state| prepare(&mut args, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    let transfer_result = user_core::updates::pay_for_streak_insurance::pay(args.from_account, args.expected_price).await;

    mutate_state(|state| {
        state
            .data
            .users
            .with_user_mut(my_index, |user| user.streak.release_payment_lock());

        match transfer_result {
            Ok(transaction_index) => {
                let now = state.env.now();
                state.mark_streak_insurance_payment(
                    my_index,
                    UserCanisterStreakInsurancePayment {
                        timestamp: now,
                        chat_amount: args.expected_price,
                        additional_days: args.additional_days,
                        new_days_insured: days_currently_insured + args.additional_days,
                        transaction_index,
                    },
                );
                Response::Success
            }
            Err(error) => Response::Error(error),
        }
    })
}

struct PrepareOk {
    my_index: u16,
    days_currently_insured: u8,
}

fn prepare(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareOk> {
    validate_from_account(args.from_account, state.env.canister_id())?;

    let now = state.env.now();
    let (my_index, days_currently_insured) = state.with_caller_user_mut(|my_index, user| {
        user_core::updates::pay_for_streak_insurance::prepare(user, args, now).map(|days| (my_index, days))
    })?;
    Ok(PrepareOk {
        my_index,
        days_currently_insured,
    })
}
