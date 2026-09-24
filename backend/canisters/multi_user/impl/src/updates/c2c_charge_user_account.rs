use crate::guards::caller_is_user_index;
use crate::{RuntimeState, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ledger_utils::Payer;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult};
use user_canister::c2c_charge_user_account::*;

// Users hold their own funds in their own wallets, so they are always charged via ICRC-2: from their
// wallet, or the external account they are paying from, either of which must have approved this
// canister as spender under the user's own spender subaccount
#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
async fn c2c_charge_user_account(args: Args) -> Response {
    let (payer, user_index_canister_id) = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    user_core::updates::c2c_charge_user_account(args, payer, user_index_canister_id).await
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<(Payer, CanisterId)> {
    let index = state
        .index_of_local_user(args.user_id)
        .ok_or(OCErrorCode::TargetUserNotFound)?;
    let wallet = state
        .data
        .users
        .with_user(index, |user| user.principal)
        .ok_or(OCErrorCode::TargetUserNotFound)?;

    let payer = Payer::Approved {
        from: args.from_account.unwrap_or(wallet.into()),
        spender_subaccount: Some(ledger_utils::spender_subaccount(wallet)),
    };
    Ok((payer, state.data.user_index_canister_id))
}
