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

// What the first sweep of a deposit address leaves on it, and every later sweep keeps there: Solana's
// minimum balance for an account holding no data, below which it refuses to leave one with any SOL
pub const RENT_EXEMPTION_THRESHOLD: u64 = 890_880;
// Each deposit's share of its sweep's transaction fee, which the minter mints it less: a sweep carries
// one signature, at 5,000 lamports, per deposit it sweeps
pub const SWEEP_FEE_PER_DEPOSIT: u64 = 5_000;
// The minimum deposit, as `get_minter_info` reported on 16 Oct 2026. The minter refuses less, but still
// charges up to 10B cycles to read the balance, so the balance is first checked against this through
// Alchemy. If the minter changes its minimum, this must follow.
pub const MINIMUM_DEPOSIT_AMOUNT: u64 = 20_000_000;

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
