use types::CanisterId;

pub type Response = Result<CanisterId, icrc_ledger_types::icrc106::errors::Icrc106Error>;
