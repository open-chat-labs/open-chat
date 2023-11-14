use candid::Nat;
use icrc_ledger_types::icrc1::account::Account;

pub type Args = (String,);
pub type Response = (Account, String, Nat, [u8; 32]);
