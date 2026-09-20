use crate::crypto::{icrc2_transfer_from, validate_from_account};
use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{CHAT_LEDGER_CANISTER_ID, MEMO_STREAK_INSURANCE, SNS_GOVERNANCE_CANISTER_ID};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use ledger_utils::icrc1::make_transfer;
use oc_error_codes::OCErrorCode;
use types::{OCResult, UserCanisterStreakInsurancePayment, UserId, icrc1};
use user_canister::pay_for_streak_insurance::*;
use user_state::Streak;

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

    let to = Account {
        owner: SNS_GOVERNANCE_CANISTER_ID,
        subaccount: None,
    };
    let amount = args.expected_price.into();
    let memo = Some(MEMO_STREAK_INSURANCE.to_vec().into());
    // Whichever account we pay from, the owner is this canister, so only the subaccount is ours to
    // choose. For ICRC-2 it picks which approval is spent rather than which account is debited.
    let subaccount = icrc1::Account::for_user(my_user_id).subaccount;

    let transfer_result = match args.from_account {
        // The allowance is what authorises this - the ledger only lets us pull from an account which
        // has approved this canister as spender - so there is nothing for us to check here.
        Some(from) => {
            icrc2_transfer_from(
                CHAT_LEDGER_CANISTER_ID,
                &TransferFromArgs {
                    spender_subaccount: subaccount,
                    from: from.into(),
                    to,
                    fee: None,
                    created_at_time: None,
                    memo,
                    amount,
                },
            )
            .await
        }
        None => match make_transfer(
            CHAT_LEDGER_CANISTER_ID,
            &TransferArg {
                from_subaccount: subaccount,
                to,
                fee: None,
                created_at_time: None,
                memo,
                amount,
            },
            false,
        )
        .await
        {
            Ok(Ok(transaction_index)) => Ok(transaction_index),
            Ok(Err(error)) => Err(OCErrorCode::TransferFailed.with_message(error)),
            Err(error) => Err(error.into()),
        },
    };

    mutate_state(|state| {
        state.data.streak.release_payment_lock();

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
    if state.data.streak.days(now) == 0 {
        return Err(OCErrorCode::NoActiveStreak.into());
    }

    let days_currently_insured = state
        .data
        .streak
        .streak_insurance(now)
        .map(|s| s.days_insured)
        .unwrap_or_default();

    if days_currently_insured.saturating_add(args.additional_days) > Streak::MAX_DAYS_INSURED {
        return Err(
            OCErrorCode::InvalidRequest.with_message(format!("At most {} days can be insured", Streak::MAX_DAYS_INSURED))
        );
    }

    let price = state
        .data
        .streak
        .insurance_price(days_currently_insured, args.additional_days);

    if price != args.expected_price {
        Err(OCErrorCode::PriceMismatch.with_message(price))
    } else if let Err(error) = state.data.pin_number.verify(args.pin.as_mut(), now) {
        Err(error.into())
    } else if !state.data.streak.acquire_payment_lock() {
        Err(OCErrorCode::AlreadyInProgress.into())
    } else {
        Ok(PrepareOk {
            my_user_id,
            days_currently_insured,
        })
    }
}
