use crate::P2PSwap;
use candid::Principal;
use escrow_canister::deposit_subaccount;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, TimestampMillis, UserId, icrc1};

// Creates a swap the user is offering in the escrow canister, returning its id. The user then
// deposits token0 into the account given by `deposit_account`.
pub async fn create_swap(escrow_canister_id: CanisterId, args: &escrow_canister::create_swap::Args) -> OCResult<u32> {
    match escrow_canister_c2c_client::create_swap(escrow_canister_id, args).await {
        Ok(escrow_canister::create_swap::Response::Success(result)) => Ok(result.id),
        Ok(escrow_canister::create_swap::Response::Error(error)) => Err(error),
        Ok(escrow_canister::create_swap::Response::InvalidSwap(message)) => {
            Err(OCErrorCode::InvalidRequest.with_message(message))
        }
        Err(error) => Err(OCErrorCode::Unknown.with_message(format!("{error:?}"))),
    }
}

// The swap as recorded against the user offering it
pub fn swap_offered(id: u32, args: &escrow_canister::create_swap::Args, offered_by: UserId, now: TimestampMillis) -> P2PSwap {
    P2PSwap {
        id,
        location: args.location.clone(),
        created_by: offered_by,
        created: now,
        token0: args.token0.clone(),
        token0_amount: args.token0_amount,
        token1: args.token1.clone(),
        token1_amount: args.token1_amount,
        expires_at: args.expires_at,
    }
}

// The escrow canister's account for a user's deposit into a swap, `depositor` being the owner of
// their wallet, by which the escrow canister knows them
pub fn deposit_account(escrow_canister_id: CanisterId, depositor: Principal, swap_id: u32) -> icrc1::Account {
    icrc1::Account {
        owner: escrow_canister_id,
        subaccount: Some(deposit_subaccount(depositor, swap_id)),
    }
}
