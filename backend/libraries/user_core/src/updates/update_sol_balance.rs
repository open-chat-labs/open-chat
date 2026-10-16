use candid::Principal;
use cksol_minter_canister::deposit_sol::{DepositSolError, InsufficientCyclesError};
use cksol_minter_canister::{CKSOL_MINTER_CANISTER_ID, DEPOSIT_SOL_REQUIRED_CYCLES, MAX_DEPOSIT_SOL_CYCLES};
use ledger_utils::convert_to_subaccount;
use oc_error_codes::OCErrorCode;
use serde::Serialize;
use tracing::error;
use types::{CanisterId, OCResult, icrc1};

// What the user is charged for a SOL deposit, in lamports, being what they sent less what they are
// credited with: more for their first, whose sweep leaves the minter's rent reserve on the address.
// Out of it come the reserve, the deposit's share of the sweep's fee and the two ledger fees, and the
// rest goes to the treasury, covering the ~55B cycles the canister pays the minter for the sweep. The
// website shows them in the deposit view from its own copies, which must match.
pub const FIRST_SOL_DEPOSIT_FEE: u64 = 2_000_000;
pub const SOL_DEPOSIT_FEE: u64 = 1_000_000;

// The account of the canister holding the user which their SOL deposits are minted to as ckSOL,
// from which the canister forwards them to the user's wallet, less the deposit fee. Its
// subaccount holds the user's principal, so whose ckSOL a subaccount holds can be read from it.
pub fn sol_deposit_account(canister_id: CanisterId, principal: Principal) -> icrc1::Account {
    icrc1::Account {
        owner: canister_id,
        subaccount: Some(convert_to_subaccount(&principal).0),
    }
}

// Asks the ckSOL minter to sweep the SOL deposited to the user's address into its own account, then
// mint that much ckSOL, less the deposit's share of the sweep's fee, to the user's deposit account.
// It mints once the sweep is finalized, after this returns the id of the deposit. A deposit already
// in flight is left as it is, and its id returned.
pub async fn update_sol_balance(deposit_account: icrc1::Account) -> OCResult<u64> {
    let args = cksol_minter_canister::deposit_sol::Args {
        owner: Some(deposit_account.owner),
        subaccount: deposit_account.subaccount,
    };

    let mut response =
        cksol_minter_canister_c2c_client::deposit_sol(CKSOL_MINTER_CANISTER_ID, &args, DEPOSIT_SOL_REQUIRED_CYCLES).await?;

    // The minter may since have been upgraded to require more cycles. It refunds what it doesn't
    // charge, so attach what it now asks for, within reason.
    if let Err(DepositSolError::InsufficientCycles(InsufficientCyclesError { expected, .. })) = &response
        && let Ok(cycles) = u128::try_from(&expected.0)
        && cycles <= MAX_DEPOSIT_SOL_CYCLES
    {
        response = cksol_minter_canister_c2c_client::deposit_sol(CKSOL_MINTER_CANISTER_ID, &args, cycles).await?;
    }

    match response {
        Ok(deposit_id) => Ok(deposit_id),
        Err(DepositSolError::ValueTooSmall { .. } | DepositSolError::AlreadyProcessing) => Err(OCErrorCode::NoChange.into()),
        Err(error) => {
            error!(?error, "Failed to update SOL balance");
            Err(OCErrorCode::Unknown.with_json(&error))
        }
    }
}

#[derive(Serialize)]
pub struct SolDepositEventPayload {
    pub amount: u64,
}
