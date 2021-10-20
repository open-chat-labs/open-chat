use crate::{BlockHeight, CanisterId, Cycles, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub enum Cryptocurrency {
    ICP,
    Cycles,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CryptocurrencyAccount {
    pub currency: Cryptocurrency,
    pub address: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyTransaction {
    Deposit(CryptocurrencyDeposit),
    Withdrawal(CryptocurrencyWithdrawal),
    Transfer(CryptocurrencyTransfer),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyDeposit {
    Cycles(CyclesDeposit),
    ICP(ICPDeposit),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyWithdrawal {
    Cycles(CyclesWithdrawal),
    ICP(ICPWithdrawal),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CyclesDeposit {
    Completed(CompletedCyclesDeposit),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedCyclesDeposit {
    pub from: CanisterId,
    pub cycles: Cycles,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ICPDeposit {
    Completed(CompletedICPDeposit),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedICPDeposit {
    pub from_address: String,
    pub amount_e8s: u64,
    pub fee_e8s: u64,
    pub memo: u64,
    pub block_height: BlockHeight,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CyclesWithdrawal {
    Pending(PendingCyclesWithdrawal),
    Completed(CompletedCyclesWithdrawal),
    Failed(FailedCyclesWithdrawal),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PendingCyclesWithdrawal {
    pub to: CanisterId,
    pub cycles: Cycles,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedCyclesWithdrawal {
    pub to: CanisterId,
    pub cycles: Cycles,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FailedCyclesWithdrawal {
    pub to: CanisterId,
    pub cycles: Cycles,
    pub error_message: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ICPWithdrawal {
    Pending(PendingICPWithdrawal),
    Completed(CompletedICPWithdrawal),
    Failed(FailedICPWithdrawal),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PendingICPWithdrawal {
    pub to: String,
    pub amount_e8s: u64,
    pub fee_e8s: Option<u64>,
    pub memo: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedICPWithdrawal {
    pub to: String,
    pub amount_e8s: u64,
    pub fee_e8s: u64,
    pub memo: u64,
    pub block_height: BlockHeight,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FailedICPWithdrawal {
    pub to: String,
    pub amount_e8s: u64,
    pub fee_e8s: u64,
    pub memo: u64,
    pub error_message: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyTransfer {
    Cycles(CyclesTransfer),
    ICP(ICPTransfer),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CyclesTransfer {
    Pending(PendingCyclesTransfer),
    Completed(CompletedCyclesTransfer),
    Failed(FailedCyclesTransfer),
}

impl CyclesTransfer {
    pub fn cycles(&self) -> Cycles {
        match self {
            Self::Pending(t) => t.cycles,
            Self::Completed(t) => t.cycles,
            Self::Failed(t) => t.cycles,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PendingCyclesTransfer {
    pub recipient: UserId,
    pub cycles: Cycles,
}

impl PendingCyclesTransfer {
    pub fn completed(&self, sender: UserId) -> CompletedCyclesTransfer {
        CompletedCyclesTransfer {
            sender,
            recipient: self.recipient,
            cycles: self.cycles,
        }
    }

    pub fn failed(&self, error_message: String) -> FailedCyclesTransfer {
        FailedCyclesTransfer {
            recipient: self.recipient,
            cycles: self.cycles,
            error_message,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedCyclesTransfer {
    pub sender: UserId,
    pub recipient: UserId,
    pub cycles: Cycles,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FailedCyclesTransfer {
    pub recipient: UserId,
    pub cycles: Cycles,
    pub error_message: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ICPTransfer {
    Pending(PendingICPTransfer),
    Completed(CompletedICPTransfer),
    Failed(FailedICPTransfer),
}

impl ICPTransfer {
    pub fn amount_e8s(&self) -> u64 {
        match self {
            Self::Pending(t) => t.amount_e8s,
            Self::Completed(t) => t.amount_e8s,
            Self::Failed(t) => t.amount_e8s,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PendingICPTransfer {
    pub recipient: UserId,
    pub amount_e8s: u64,
    pub fee_e8s: Option<u64>,
    pub memo: Option<u64>,
}

impl PendingICPTransfer {
    pub fn completed(&self, sender: UserId, fee_e8s: u64, memo: u64, block_height: BlockHeight) -> CompletedICPTransfer {
        CompletedICPTransfer {
            sender,
            recipient: self.recipient,
            amount_e8s: self.amount_e8s,
            fee_e8s,
            memo,
            block_height,
        }
    }

    pub fn failed(&self, fee_e8s: u64, memo: u64, error_message: String) -> FailedICPTransfer {
        FailedICPTransfer {
            recipient: self.recipient,
            amount_e8s: self.amount_e8s,
            fee_e8s,
            memo,
            error_message,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedICPTransfer {
    pub sender: UserId,
    pub recipient: UserId,
    pub amount_e8s: u64,
    pub fee_e8s: u64,
    pub memo: u64,
    pub block_height: BlockHeight,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FailedICPTransfer {
    pub recipient: UserId,
    pub amount_e8s: u64,
    pub fee_e8s: u64,
    pub memo: u64,
    pub error_message: String,
}
