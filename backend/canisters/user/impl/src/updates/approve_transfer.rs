use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::NANOS_PER_MILLISECOND;
use icrc_ledger_types::icrc2::approve::ApproveArgs;
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampNanos};
use user_canister::approve_transfer::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn approve_transfer(args: Args) -> Response {
    execute_update_async(|| approve_transfer_impl(args)).await.into()
}

pub(crate) async fn approve_transfer_impl(args: Args) -> OCResult {
    let now_nanos = mutate_state(|state| prepare(&args, state))?;

    match icrc_ledger_canister_c2c_client::icrc2_approve(
        args.ledger_canister_id,
        &ApproveArgs {
            from_subaccount: None,
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

fn prepare(args: &Args, state: &mut RuntimeState) -> OCResult<TimestampNanos> {
    state.data.verify_not_suspended()?;
    let now = state.env.now();
    state.data.pin_number.verify(args.pin.as_deref(), now)?;

    Ok(now * NANOS_PER_MILLISECOND)
}
