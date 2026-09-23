use crate::{Streak, User};
use constants::{CHAT_LEDGER_CANISTER_ID, MEMO_STREAK_INSURANCE, SNS_GOVERNANCE_CANISTER_ID};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use ledger_utils::icrc1::make_transfer;
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampMillis, icrc1};
use user_canister::pay_for_streak_insurance::Args;

// Checks the request against the user's streak and takes the payment lock, which the caller
// releases once the payment has been attempted. Returns the days currently insured, for the caller
// to add the new days to once the payment succeeds. The caller has already checked `from_account`.
pub fn prepare(user: &mut User, args: &mut Args, now: TimestampMillis) -> OCResult<u8> {
    if user.streak.days(now) == 0 {
        return Err(OCErrorCode::NoActiveStreak.into());
    }

    let days_currently_insured = user.streak.streak_insurance(now).map(|s| s.days_insured).unwrap_or_default();
    if days_currently_insured.saturating_add(args.additional_days) > Streak::MAX_DAYS_INSURED {
        return Err(
            OCErrorCode::InvalidRequest.with_message(format!("At most {} days can be insured", Streak::MAX_DAYS_INSURED))
        );
    }

    let price = user.streak.insurance_price(days_currently_insured, args.additional_days);
    if price != args.expected_price {
        Err(OCErrorCode::PriceMismatch.with_message(price))
    } else if let Err(error) = user.pin_number.verify(args.pin.as_mut(), now) {
        Err(error.into())
    } else if !user.streak.acquire_payment_lock() {
        Err(OCErrorCode::AlreadyInProgress.into())
    } else {
        Ok(days_currently_insured)
    }
}

// Pays the SNS governance canister, returning the transaction index, from this canister's own
// account, or for ICRC-2 from `from_account`, which must have approved this canister. The caller has
// already checked `from_account` isn't one of this canister's own.
pub async fn pay(from_account: Option<icrc1::Account>, amount: u128) -> OCResult<u64> {
    let to = Account {
        owner: SNS_GOVERNANCE_CANISTER_ID,
        subaccount: None,
    };
    let amount = amount.into();
    let memo = Some(MEMO_STREAK_INSURANCE.to_vec().into());
    let subaccount = None;

    match from_account {
        // The allowance is what authorises this: the ledger only lets us pull from an account which
        // has approved the spender we pass, the user's subaccount of this canister
        Some(from) => {
            ledger_utils::icrc2_transfer_from(
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
    }
}
