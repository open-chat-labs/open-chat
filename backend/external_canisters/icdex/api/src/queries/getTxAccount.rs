use candid::Nat;
use types::icrc1::Account;

pub type Args = (String,);
pub type Response = (Account, String, Nat, [u8; 32]);
