use crate::{ErrorMessage, EvmAccount, FetchedBlock, IcpAccount, Token, TransferId};
use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};
use types::EvmChain;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub token: Token,
    pub evm_account: EvmAccount,
    pub icp_account: IcpAccount,
    pub evm_chain: EvmChain,
    pub evm_amount: Option<Nat>,
    pub icp_amount: Nat,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Response {
    Accepted(TransferId),
    Fetching(FetchedBlock),
    Failed(ErrorMessage),
}
