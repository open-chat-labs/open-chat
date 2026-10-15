mod queries;
mod updates;

use candid::Principal;
pub use queries::*;
pub use updates::*;

pub const CKSOL_MINTER_CANISTER_ID: Principal = Principal::from_slice(&[0, 0, 0, 0, 2, 48, 15, 91, 1, 1]);
pub const CKSOL_LEDGER_CANISTER_ID: Principal = Principal::from_slice(&[0, 0, 0, 0, 2, 48, 15, 92, 1, 1]);

// The cycles the minter requires attached to a `deposit_sol` call, of which it keeps the cost of
// reading the deposit address's balance, plus its fee if a deposit is queued, and refunds the rest
pub const DEPOSIT_SOL_REQUIRED_CYCLES: u128 = 1_000_000_000_000;
// The most the canister will attach should the minter come to require more
pub const MAX_DEPOSIT_SOL_CYCLES: u128 = 2_000_000_000_000;

#[test]
fn cksol_minter_canister_id() {
    let canister_id = Principal::from_text("lh22c-kyaaa-aaaar-qb5nq-cai").unwrap();

    assert_eq!(canister_id, CKSOL_MINTER_CANISTER_ID);
}

#[test]
fn cksol_ledger_canister_id() {
    let canister_id = Principal::from_text("ls5lp-lqaaa-aaaar-qb5oa-cai").unwrap();

    assert_eq!(canister_id, CKSOL_LEDGER_CANISTER_ID);
}
