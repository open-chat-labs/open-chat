use candid::Principal;
use icrc_ledger_types::icrc1::account::Subaccount;
use sha256::sha256;
use types::UserId;

mod lifecycle;
mod updates;

pub use lifecycle::*;
pub use updates::*;

pub fn deposit_subaccount(user_id: UserId, offer_id: u32) -> Subaccount {
    let mut bytes = Vec::new();
    bytes.extend_from_slice(Principal::from(user_id).as_slice());
    bytes.extend_from_slice(&offer_id.to_be_bytes());
    sha256(&bytes)
}
