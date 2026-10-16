use candid::CandidType;
use serde::{Deserialize, Serialize};

// The id of a deposit returned by `deposit_sol`
pub type Args = u64;

pub type Response = DepositSolStatus;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum DepositSolStatus {
    NotFound,
    // Queued for a sweep to the minter's main account
    Queued { sweepable_amount: u64 },
    // The sweep has been submitted but is not yet finalized
    Swept { signature: String },
    // The sweep is finalized but the ckSOL is not yet minted
    Finalized { signature: String },
    // The sweepable amount less the deposit's share of the sweep's fee has been minted
    Minted { block_index: u64, minted_amount: u64 },
    // The sweep failed or expired, so nothing is owed. Calling `deposit_sol` again queues a new
    // sweep of what the address still holds.
    Dropped { signature: String },
    // The minter stopped processing the deposit, which needs a minter upgrade to resolve
    Quarantined { signature: String },
}
