use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{TimestampMillis, ICP};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, Eq, PartialEq)]
pub struct AccountBilling {
    payments: Vec<AccountPayment>,
    charges: Vec<AccountCharge>,
}

impl AccountBilling {
    pub fn add_payment(&mut self, payment: AccountPayment) {
        self.payments.push(payment);
    }

    pub fn add_charge(&mut self, charge: AccountCharge) {
        self.charges.push(charge);
    }

    // TODO account for the burned ICP once we implement burning
    pub fn ledger_balance(&self) -> ICP {
        ICP::from_e8s(self.payments.iter().map(|p| p.amount.e8s()).sum())
    }

    pub fn credit(&self) -> ICP {
        let payments_total: u64 = self.payments.iter().map(|p| p.amount.e8s()).sum();
        let charges_total: u64 = self.charges.iter().map(|c| c.amount.e8s()).sum();

        ICP::from_e8s(payments_total.saturating_sub(charges_total))
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct AccountPayment {
    pub amount: ICP,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct AccountCharge {
    pub amount: ICP,
    pub timestamp: TimestampMillis,
    pub details: AccountChargeDetails,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum AccountChargeDetails {
    Storage(StorageAccountChargeDetails),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct StorageAccountChargeDetails {
    pub old_bytes_limit: u64,
    pub new_bytes_limit: u64,
}
