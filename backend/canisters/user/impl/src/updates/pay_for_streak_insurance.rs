use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{MEMO_STREAK_INSURANCE, SNS_GOVERNANCE_CANISTER_ID, SNS_LEDGER_CANISTER_ID};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use ledger_utils::icrc1::make_transfer;
use types::UserCanisterStreakInsurancePayment;
use user_canister::pay_for_streak_insurance::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn pay_for_streak_insurance(args: Args) -> Response {
    run_regular_jobs();

    let PrepareOk { days_currently_insured } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let transfer_result = make_transfer(
        SNS_LEDGER_CANISTER_ID,
        &TransferArg {
            from_subaccount: None,
            to: Account {
                owner: SNS_GOVERNANCE_CANISTER_ID,
                subaccount: None,
            },
            fee: None,
            created_at_time: None,
            memo: Some(MEMO_STREAK_INSURANCE.to_vec().into()),
            amount: args.expected_price.into(),
        },
        false,
    )
    .await;

    mutate_state(|state| {
        state.data.streak.release_payment_lock();

        match transfer_result {
            Ok(Ok(transaction_index)) => {
                let now = state.env.now();
                state.mark_streak_insurance_payment(UserCanisterStreakInsurancePayment {
                    timestamp: now,
                    chat_amount: args.expected_price,
                    additional_days: args.additional_days,
                    new_days_insured: days_currently_insured + args.additional_days,
                    transaction_index,
                });
                Success
            }
            Ok(Err(error)) => PaymentFailed(format!("{error:?}")),
            Err(error) => InternalError(format!("{error:?}")),
        }
    })
}

struct PrepareOk {
    days_currently_insured: u8,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let now = state.env.now();
    let days_currently_insured = state
        .data
        .streak
        .streak_insurance(now)
        .map(|s| s.days_insured)
        .unwrap_or_default();
    let price = state
        .data
        .streak
        .insurance_price(days_currently_insured, args.additional_days);

    if price != args.expected_price {
        Err(IncorrectPrice(price))
    } else if !state.data.streak.acquire_payment_lock() {
        Err(PaymentAlreadyInProgress)
    } else {
        Ok(PrepareOk { days_currently_insured })
    }
}
