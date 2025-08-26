use candid::Nat;
use icrc_ledger_types::icrc2::approve::ApproveArgs;
use types::icrc2::ApproveError;

pub type Args = ApproveArgs;
pub type Response = Result<Nat, ApproveError>;
