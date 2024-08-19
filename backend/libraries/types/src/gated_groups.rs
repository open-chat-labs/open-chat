use crate::{CanisterId, Milliseconds};
use candid::{CandidType, Principal};
use icrc_ledger_types::icrc2::transfer_from::TransferFromError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_optional::ts_optional;
use ts_rs::TS;

pub const SNS_FEE_SHARE_PERCENT: u128 = 2;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq, TS)]
pub enum AccessGate {
    DiamondMember,
    LifetimeDiamondMember,
    UniquePerson,
    VerifiedCredential(VerifiedCredentialGate),
    SnsNeuron(SnsNeuronGate),
    Payment(PaymentGate),
    TokenBalance(TokenBalanceGate),
    Composite(CompositeGate),
    Locked,
}

impl AccessGate {
    pub fn validate(&self) -> bool {
        if let AccessGate::Composite(g) = self {
            if g.inner.is_empty() || g.inner.len() > 10 {
                return false;
            }
            if g.inner.iter().any(|i| matches!(i, AccessGate::Composite(_))) {
                return false;
            }
        }
        true
    }

    pub fn is_payment_gate(&self) -> bool {
        matches!(self, AccessGate::Payment(_))
    }

    pub fn gate_type(&self) -> &'static str {
        match self {
            AccessGate::DiamondMember => "diamond",
            AccessGate::LifetimeDiamondMember => "lifetime_diamond",
            AccessGate::UniquePerson => "unique_person",
            AccessGate::VerifiedCredential(_) => "verified_credential",
            AccessGate::SnsNeuron(_) => "sns_neuron",
            AccessGate::Payment(_) => "payment",
            AccessGate::TokenBalance(_) => "token_balance",
            AccessGate::Composite(_) => "composite",
            AccessGate::Locked => "locked",
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq, TS)]
pub struct VerifiedCredentialGate {
    pub issuer_canister_id: CanisterId,
    pub issuer_origin: String,
    pub credential_type: String,
    pub credential_name: String,
    pub credential_arguments: HashMap<String, VerifiedCredentialArgumentValue>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq, TS)]
pub enum VerifiedCredentialArgumentValue {
    String(String),
    Int(i32),
}

#[ts_optional]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq, TS)]
pub struct SnsNeuronGate {
    pub governance_canister_id: CanisterId,
    pub min_stake_e8s: Option<u64>,
    pub min_dissolve_delay: Option<Milliseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq, TS)]
pub struct PaymentGate {
    pub ledger_canister_id: CanisterId,
    pub amount: u128,
    pub fee: u128,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq, TS)]
pub struct TokenBalanceGate {
    pub ledger_canister_id: CanisterId,
    pub min_balance: u128,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq, TS)]
pub struct CompositeGate {
    pub inner: Vec<AccessGate>,
    pub and: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub enum GateCheckFailedReason {
    NotDiamondMember,
    NotLifetimeDiamondMember,
    NoUniquePersonProof,
    NoSnsNeuronsFound,
    NoSnsNeuronsWithRequiredStakeFound,
    NoSnsNeuronsWithRequiredDissolveDelayFound,
    PaymentFailed(#[ts(as = "TransferFromErrorJS")] TransferFromError),
    InsufficientBalance(u128),
    FailedVerifiedCredentialCheck(String),
    Locked,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct VerifiedCredentialGateArgs {
    pub user_ii_principal: Principal,
    pub credential_jwt: String,
    #[serde(default)]
    pub credential_jwts: Vec<String>,
    pub ii_origin: String,
}

impl VerifiedCredentialGateArgs {
    pub fn credential_jwts(&self) -> Vec<String> {
        let mut credential_jwts = self.credential_jwts.clone();
        if !self.credential_jwt.is_empty() && !credential_jwts.contains(&self.credential_jwt) {
            credential_jwts.push(self.credential_jwt.clone());
        }
        credential_jwts
    }
}

#[derive(TS)]
pub enum TransferFromErrorJS {
    BadFee { expected_fee: u128 },
    BadBurn { min_burn_amount: u128 },
    // The [from] account does not hold enough funds for the transfer.
    InsufficientFunds { balance: u128 },
    // The caller exceeded its allowance.
    InsufficientAllowance { allowance: u128 },
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: u128 },
    TemporarilyUnavailable,
    GenericError { error_code: u128, message: String },
}
