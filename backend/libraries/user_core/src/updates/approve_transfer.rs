use crate::User;
use constants::NANOS_PER_MILLISECOND;
use icrc_ledger_types::icrc2::approve::ApproveArgs;
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampMillis, TimestampNanos, UserId, icrc1};
use user_canister::approve_transfer::Args;

// Checks the user may approve a transfer, verifying their PIN, and returns the time to date the
// approval from
pub fn prepare(user: &mut User, args: &mut Args, now: TimestampMillis) -> OCResult<TimestampNanos> {
    user.verify_not_suspended()?;
    user.pin_number.verify(args.pin.as_mut(), now)?;
    Ok(now * NANOS_PER_MILLISECOND)
}

// Approves the spender to transfer from the user's account
pub async fn approve(args: Args, my_user_id: UserId, now_nanos: TimestampNanos) -> OCResult {
    match icrc_ledger_canister_c2c_client::icrc2_approve(
        args.ledger_canister_id,
        &ApproveArgs {
            from_subaccount: icrc1::Account::for_user(my_user_id).subaccount,
            spender: args.spender.into(),
            amount: args.amount.into(),
            expected_allowance: None,
            expires_at: args
                .expires_in
                .map(|expires_in| now_nanos + expires_in * NANOS_PER_MILLISECOND),
            fee: None,
            memo: None,
            created_at_time: Some(now_nanos),
        },
    )
    .await?
    {
        Ok(_) => Ok(()),
        Err(error) => Err(OCErrorCode::ApprovalFailed.with_json(&error)),
    }
}
