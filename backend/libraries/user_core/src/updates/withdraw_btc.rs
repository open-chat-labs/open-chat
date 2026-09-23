use ckbtc_minter_canister::CKBTC_MINTER_CANISTER_ID;
use constants::{CKBTC_LEDGER_CANISTER_ID, MINUTE_IN_MS, NANOS_PER_MILLISECOND};
use icrc_ledger_types::icrc2::approve::ApproveArgs;
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampNanos, UserId, icrc1};
use user_canister::withdraw_btc::Args;

// Approves the ckBTC minter to take the amount from the user's account, then has it retrieve the
// BTC to the address. The caller has verified the user's PIN. Returns the block index of the burn.
pub async fn withdraw_btc(args: &Args, my_user_id: UserId, now_nanos: TimestampNanos) -> OCResult<u64> {
    let from_subaccount = icrc1::Account::holding_canister_account(my_user_id).subaccount;

    icrc_ledger_canister_c2c_client::icrc2_approve(
        CKBTC_LEDGER_CANISTER_ID,
        &ApproveArgs {
            from_subaccount,
            spender: CKBTC_MINTER_CANISTER_ID.into(),
            amount: args.amount.into(),
            expected_allowance: None,
            expires_at: Some(now_nanos + (5 * MINUTE_IN_MS * NANOS_PER_MILLISECOND)),
            fee: None,
            memo: None,
            created_at_time: Some(now_nanos),
        },
    )
    .await?
    .map_err(|error| OCErrorCode::ApprovalFailed.with_json(&error))?;

    let result = ckbtc_minter_canister_c2c_client::retrieve_btc_with_approval(
        CKBTC_MINTER_CANISTER_ID,
        &ckbtc_minter_canister::retrieve_btc_with_approval::Args {
            amount: args.amount,
            address: args.address.clone(),
            from_subaccount,
        },
    )
    .await?
    .map_err(|error| OCErrorCode::Unknown.with_json(&error))?;

    Ok(result.block_index)
}
