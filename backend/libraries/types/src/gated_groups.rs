use crate::{CanisterId, Milliseconds};
use candid::{CandidType, Principal};
use icrc_ledger_types::icrc2::transfer_from::TransferFromError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const SNS_FEE_SHARE_PERCENT: u128 = 2;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum AccessGate {
    DiamondMember,
    LifetimeDiamondMember,
    VerifiedCredential(VerifiedCredentialGate),
    SnsNeuron(SnsNeuronGate),
    Payment(PaymentGate),
    TokenBalance(TokenBalanceGate),
    Composite(CompositeGate),
}

impl AccessGate {
    pub fn synchronous(&self) -> bool {
        match self {
            AccessGate::DiamondMember | AccessGate::LifetimeDiamondMember | AccessGate::VerifiedCredential(_) => true,
            AccessGate::Composite(c) => c.synchronous(),
            _ => false,
        }
    }

    pub fn is_payment_gate(&self) -> bool {
        matches!(self, AccessGate::Payment(_))
    }

    pub fn gate_type(&self) -> &'static str {
        match self {
            AccessGate::DiamondMember => "diamond",
            AccessGate::LifetimeDiamondMember => "lifetime_diamond",
            AccessGate::VerifiedCredential(_) => "verified_credential",
            AccessGate::SnsNeuron(_) => "sns_neuron",
            AccessGate::Payment(_) => "payment",
            AccessGate::TokenBalance(_) => "token_balance",
            AccessGate::Composite(_) => "composite",
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct VerifiedCredentialGate {
    pub issuer_canister_id: CanisterId,
    pub issuer_origin: String,
    pub credential_type: String,
    pub credential_name: String,
    pub credential_arguments: HashMap<String, VerifiedCredentialArgumentValue>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum VerifiedCredentialArgumentValue {
    String(String),
    Int(i32),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct SnsNeuronGate {
    pub governance_canister_id: CanisterId,
    pub min_stake_e8s: Option<u64>,
    pub min_dissolve_delay: Option<Milliseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct PaymentGate {
    pub ledger_canister_id: CanisterId,
    pub amount: u128,
    pub fee: u128,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct TokenBalanceGate {
    pub ledger_canister_id: CanisterId,
    pub min_balance: u128,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct CompositeGate {
    pub left: Box<AccessGate>,
    pub right: Box<AccessGate>,
    pub and: bool,
}

impl CompositeGate {
    pub fn synchronous(&self) -> bool {
        self.left.synchronous() && self.right.synchronous()
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum GateCheckFailedReason {
    NotDiamondMember,
    NotLifetimeDiamondMember,
    NoSnsNeuronsFound,
    NoSnsNeuronsWithRequiredStakeFound,
    NoSnsNeuronsWithRequiredDissolveDelayFound,
    PaymentFailed(TransferFromError),
    InsufficientBalance(u128),
    FailedVerifiedCredentialCheck(String),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct VerifiedCredentialGateArgs {
    pub user_ii_principal: Principal,
    pub credential_jwt: String,
    pub ii_origin: String,
}
