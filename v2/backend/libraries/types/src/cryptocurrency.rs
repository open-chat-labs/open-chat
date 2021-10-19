use crate::{BlockHeight, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Copy, Clone, Debug)]
pub enum Cryptocurrency {
    ICP,
    Cycles,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CryptocurrencyTransaction {
    pub currency: Cryptocurrency,
    pub block_height: Option<BlockHeight>,
    pub transfer: CryptocurrencyTransfer,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum CryptocurrencyTransfer {
    Deposit(CryptocurrencyDeposit),
    Withdrawal(CryptocurrencyWithdrawal),
    Send(CryptocurrencySend),
    Receive(CryptocurrencyReceive),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CryptocurrencyDeposit {
    pub from: String,
    pub amount: u128,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CryptocurrencyWithdrawal {
    pub to: String,
    pub amount: u128,
    pub fee: u128,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CryptocurrencySend {
    pub to_user: UserId,
    pub to: String,
    pub amount: u128,
    pub fee: u128,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CryptocurrencyReceive {
    pub from_user: UserId,
    pub from: String,
    pub amount: u128,
}
