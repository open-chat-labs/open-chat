use candid::Principal;
use icrc_ledger_types::icrc1::account::Subaccount;
use types::UserId;

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

pub fn deposit_subaccount(user_id: UserId, offer_id: u32) -> Subaccount {
    let mut subaccount = [0; 32];
    let principal = Principal::from(user_id);
    let user_id_bytes = principal.as_slice();
    subaccount[..user_id_bytes.len()].copy_from_slice(user_id_bytes);
    subaccount[28..].copy_from_slice(&offer_id.to_be_bytes());
    subaccount
}
