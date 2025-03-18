mod updates;

use candid::Principal;
pub use updates::*;

pub const CKBTC_MINTER_CANISTER_ID: Principal = Principal::from_slice(&[0, 0, 0, 0, 2, 48, 0, 7, 1, 1]);
pub const TESTNET_CKBTC_MINTER_CANISTER_ID: Principal = Principal::from_slice(&[0, 0, 0, 0, 2, 48, 0, 2, 1, 1]);

#[test]
fn ckbtc_minter_canister_id() {
    let canister_id = Principal::from_text("mqygn-kiaaa-aaaar-qaadq-cai").unwrap();

    assert_eq!(canister_id, CKBTC_MINTER_CANISTER_ID);
}

#[test]
fn testnet_ckbtc_minter_canister_id() {
    let canister_id = Principal::from_text("ml52i-qqaaa-aaaar-qaaba-cai").unwrap();

    assert_eq!(canister_id, TESTNET_CKBTC_MINTER_CANISTER_ID);
}
