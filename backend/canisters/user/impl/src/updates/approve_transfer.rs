use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::NANOS_PER_MILLISECOND;
use icrc_ledger_types::icrc1::account::{Account, Subaccount};
use icrc_ledger_types::icrc2::approve::ApproveArgs;
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampNanos, UserId};
use user_canister::approve_transfer::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn approve_transfer(args: Args) -> Response {
    execute_update_async(|| approve_transfer_impl(args)).await.into()
}

pub(crate) async fn approve_transfer_impl(mut args: Args) -> OCResult {
    let (now_nanos, from_subaccount) = mutate_state(|state| prepare(&mut args, state))?;

    match icrc_ledger_canister_c2c_client::icrc2_approve(
        args.ledger_canister_id,
        &ApproveArgs {
            from_subaccount,
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

// Returns the current time in nanos and the subaccount the approval is granted from
fn prepare(args: &mut Args, state: &mut RuntimeState) -> OCResult<(TimestampNanos, Option<Subaccount>)> {
    state.data.verify_not_suspended()?;
    let now = state.env.now();
    state.data.pin_number.verify(args.pin.as_mut(), now)?;

    let my_user_id = UserId::from(state.env.canister_id());
    Ok((now * NANOS_PER_MILLISECOND, Account::from(my_user_id).subaccount))
}
