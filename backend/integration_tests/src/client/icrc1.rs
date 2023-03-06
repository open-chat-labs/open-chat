use crate::{generate_query_call, generate_update_call};

// Queries
generate_query_call!(icrc1_balance_of);

// Updates
generate_update_call!(icrc1_transfer);

pub mod icrc1_balance_of {
    pub type Args = ic_icrc1::Account;
    pub type Response = candid::Nat;
}

pub mod icrc1_transfer {
    pub type Args = ic_icrc1::endpoints::TransferArg;
    pub type Response = Result<candid::Nat, ic_icrc1::endpoints::TransferError>;
}
