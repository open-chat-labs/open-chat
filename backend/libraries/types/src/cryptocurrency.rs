use crate::{CanisterId, Cycles, UserId, ICP};
use candid::CandidType;
use ic_ledger_types::{AccountIdentifier, BlockIndex, Memo};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub enum Cryptocurrency {
    ICP,
    Cycles,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyAccount {
    ICP(AccountIdentifier),
    Cycles(CanisterId),
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
pub enum PendingCryptocurrencyWithdrawal {
    Cycles(PendingCyclesWithdrawal),
    ICP(PendingICPWithdrawal),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CompletedCryptocurrencyWithdrawal {
    Cycles(CompletedCyclesWithdrawal),
    ICP(CompletedICPWithdrawal),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum FailedCryptocurrencyWithdrawal {
    Cycles(FailedCyclesWithdrawal),
    ICP(FailedICPWithdrawal),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CompletedCryptocurrencyTransfer {
    Cycles(CompletedCyclesTransfer),
    ICP(CompletedICPTransfer),
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
    pub from_address: AccountIdentifier,
    pub amount: ICP,
    pub fee: ICP,
    pub memo: Memo,
    pub block_index: BlockIndex,
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
    pub to: AccountIdentifier,
    pub amount: ICP,
    pub fee: Option<ICP>,
    pub memo: Option<Memo>,
}

impl PendingICPWithdrawal {
    pub fn completed(
        &self,
        fee: ICP,
        memo: Memo,
        block_index: BlockIndex,
        transaction_hash: TransactionHash,
    ) -> CompletedICPWithdrawal {
        CompletedICPWithdrawal {
            to: self.to,
            amount: self.amount,
            fee,
            memo,
            block_index,
            transaction_hash,
        }
    }

    pub fn failed(&self, fee: ICP, memo: Memo, error_message: String) -> FailedICPWithdrawal {
        FailedICPWithdrawal {
            to: self.to,
            amount: self.amount,
            fee,
            memo,
            error_message,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedICPWithdrawal {
    pub to: AccountIdentifier,
    pub amount: ICP,
    pub fee: ICP,
    pub memo: Memo,
    pub block_index: BlockIndex,
    pub transaction_hash: TransactionHash,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FailedICPWithdrawal {
    pub to: AccountIdentifier,
    pub amount: ICP,
    pub fee: ICP,
    pub memo: Memo,
    pub error_message: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CryptocurrencyTransfer {
    Cycles(CyclesTransfer),
    ICP(ICPTransfer),
}

impl CryptocurrencyTransfer {
    pub fn cryptocurrency(&self) -> Cryptocurrency {
        match self {
            CryptocurrencyTransfer::Cycles(_) => Cryptocurrency::Cycles,
            CryptocurrencyTransfer::ICP(_) => Cryptocurrency::ICP,
        }
    }

    pub fn recipient(&self) -> UserId {
        match self {
            CryptocurrencyTransfer::Cycles(c) => c.recipient(),
            CryptocurrencyTransfer::ICP(icp) => icp.recipient(),
        }
    }

    pub fn is_zero(&self) -> bool {
        match self {
            CryptocurrencyTransfer::Cycles(c) => c.cycles() == 0,
            CryptocurrencyTransfer::ICP(icp) => icp.amount().e8s() == 0,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CyclesTransfer {
    Pending(PendingCyclesTransfer),
    Completed(CompletedCyclesTransfer),
    Failed(FailedCyclesTransfer),
}

impl CyclesTransfer {
    pub fn recipient(&self) -> UserId {
        match self {
            Self::Pending(t) => t.recipient,
            Self::Completed(t) => t.recipient,
            Self::Failed(t) => t.recipient,
        }
    }

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
    pub fn recipient(&self) -> UserId {
        match self {
            Self::Pending(t) => t.recipient,
            Self::Completed(t) => t.recipient,
            Self::Failed(t) => t.recipient,
        }
    }

    pub fn amount(&self) -> ICP {
        match self {
            Self::Pending(t) => t.amount,
            Self::Completed(t) => t.amount,
            Self::Failed(t) => t.amount,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PendingICPTransfer {
    pub recipient: UserId,
    pub amount: ICP,
    pub fee: Option<ICP>,
    pub memo: Option<Memo>,
}

impl PendingICPTransfer {
    pub fn completed(
        &self,
        sender: UserId,
        fee: ICP,
        memo: Memo,
        block_index: BlockIndex,
        transaction_hash: TransactionHash,
    ) -> CompletedICPTransfer {
        CompletedICPTransfer {
            sender,
            recipient: self.recipient,
            amount: self.amount,
            fee,
            memo,
            block_index,
            transaction_hash,
        }
    }

    pub fn failed(&self, fee: ICP, memo: Memo, error_message: String) -> FailedICPTransfer {
        FailedICPTransfer {
            recipient: self.recipient,
            amount: self.amount,
            fee,
            memo,
            error_message,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CompletedICPTransfer {
    pub sender: UserId,
    pub recipient: UserId,
    pub amount: ICP,
    pub fee: ICP,
    pub memo: Memo,
    pub block_index: BlockIndex,
    pub transaction_hash: TransactionHash,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FailedICPTransfer {
    pub recipient: UserId,
    pub amount: ICP,
    pub fee: ICP,
    pub memo: Memo,
    pub error_message: String,
}

pub type TransactionHash = [u8; 32];
