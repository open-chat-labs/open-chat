use candid::Nat;

// (token0 amount, token1 amount, subaccount): `None` for an amount withdraws the whole available
// balance of that token. Returns the amounts sent to the caller's ledger accounts, net of the
// ledger fees. The ledger transfers themselves run asynchronously inside ICDex, so they may land
// after the call returns.
pub type Args = (Option<Nat>, Option<Nat>, Option<[u8; 32]>);
pub type Response = (Nat, Nat);
