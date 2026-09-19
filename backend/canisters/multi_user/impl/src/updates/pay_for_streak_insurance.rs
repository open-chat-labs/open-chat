use crate::crypto::{icrc2_transfer_from, validate_from_account};
use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
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

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn pay_for_streak_insurance(mut args: Args) -> Response {
    let PrepareOk {
        my_index,
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
    // The user's funds are held in this canister's subaccount for the user. For ICRC-2 the
    // subaccount picks which approval is spent rather than which account is debited.
    let subaccount = icrc1::Account::for_user(my_user_id).subaccount;

    let transfer_result = match args.from_account {
        // The allowance is what authorises this - the ledger only lets us pull from an account which
        // has approved the user's subaccount of this canister as spender
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
    my_user_id: UserId,
    days_currently_insured: u8,
}

fn prepare(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareOk> {
    validate_from_account(args.from_account, state.env.canister_id())?;

    let now = state.env.now();
    let (my_index, days_currently_insured) = state.with_caller_user_mut(|my_index, user| {
        if user.streak.days(now) == 0 {
            return Err(OCErrorCode::NoActiveStreak.into());
        }

        let days_currently_insured = user.streak.streak_insurance(now).map(|s| s.days_insured).unwrap_or_default();

        let price = user.streak.insurance_price(days_currently_insured, args.additional_days);

        if price != args.expected_price {
            Err(OCErrorCode::PriceMismatch.with_message(price))
        } else if let Err(error) = user.pin_number.verify(args.pin.as_mut(), now) {
            Err(error.into())
        } else if !user.streak.acquire_payment_lock() {
            Err(OCErrorCode::AlreadyInProgress.into())
        } else {
            Ok((my_index, days_currently_insured))
        }
    })?;

    Ok(PrepareOk {
        my_index,
        my_user_id: state.user_id(my_index),
        days_currently_insured,
    })
}
