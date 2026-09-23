use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ledger_utils::Payer;
use types::{OCResult, UserCanisterStreakInsurancePayment};
use user_canister::pay_for_streak_insurance::*;

// Users hold their own funds in their own wallets, so they always pay via ICRC-2: from their wallet,
// or the external account they are paying from, either of which must have approved this canister as
// spender under the user's own spender subaccount
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn pay_for_streak_insurance(mut args: Args) -> Response {
    let PrepareOk {
        my_index,
        days_currently_insured,
        payer,
    } = match mutate_state(|state| prepare(&mut args, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    let transfer_result = user_core::updates::pay_for_streak_insurance::pay(payer, args.expected_price).await;

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
    payer: Payer,
}

fn prepare(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareOk> {
    ledger_utils::validate_from_account(args.from_account, state.env.canister_id())?;

    let now = state.env.now();
    let (my_index, (days_currently_insured, wallet)) = state.with_caller_user_mut(|my_index, user| {
        let days_currently_insured = user_core::updates::pay_for_streak_insurance::prepare(user, args, now)?;
        OCResult::Ok((my_index, (days_currently_insured, user.principal)))
    })?;

    let payer = Payer::Approved {
        from: args.from_account.unwrap_or(wallet.into()),
        spender_subaccount: Some(ledger_utils::spender_subaccount(state.user_id(my_index))),
    };
    Ok(PrepareOk {
        my_index,
        days_currently_insured,
        payer,
    })
}
