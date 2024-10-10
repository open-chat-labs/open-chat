use crate::icrc2::TransferFromError;
use crate::{CanisterId, Milliseconds};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::{Display, Formatter};
use ts_export::ts_export;

pub const SNS_FEE_SHARE_PERCENT: u128 = 2;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AccessGateConfig {
    pub gate: AccessGate,
    pub expiry: Option<Milliseconds>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
// #[serde(from = "AccessGate")]
pub struct AccessGateConfigInternal {
    pub gate: AccessGate,
    pub expiry: Option<Milliseconds>,
}

impl AccessGateConfigInternal {
    pub fn expiry(&self) -> Option<Milliseconds> {
        let expiry_type: AccessGateExpiryBehaviour = self.gate().into();
        match expiry_type {
            AccessGateExpiryBehaviour::Invalid => None,
            _ => self.expiry,
        }
    }

    pub fn gate(&self) -> &AccessGate {
        &self.gate
    }
}

// TODO: Delete this after it is released
impl From<AccessGate> for AccessGateConfig {
    fn from(value: AccessGate) -> Self {
        AccessGateConfig {
            gate: value,
            expiry: None,
        }
    }
}

// TODO: Delete this after it is released
impl From<AccessGate> for AccessGateConfigInternal {
    fn from(value: AccessGate) -> Self {
        AccessGateConfigInternal {
            gate: value,
            expiry: None,
        }
    }
}

impl From<AccessGateConfigInternal> for AccessGateConfig {
    fn from(value: AccessGateConfigInternal) -> Self {
        AccessGateConfig {
            gate: value.gate,
            expiry: value.expiry,
        }
    }
}

impl From<AccessGateConfig> for AccessGateConfigInternal {
    fn from(value: AccessGateConfig) -> Self {
        AccessGateConfigInternal {
            gate: value.gate,
            expiry: value.expiry,
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
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
    ReferredByMember,
}

#[derive(Serialize, Deserialize, Eq, PartialEq)]
pub enum AccessGateType {
    DiamondMember,
    LifetimeDiamondMember,
    UniquePerson,
    VerifiedCredential,
    SnsNeuron,
    Payment,
    TokenBalance,
    Composite,
    Locked,
    ReferredByMember,
}

impl Display for AccessGateType {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let str = match self {
            AccessGateType::DiamondMember => "diamond",
            AccessGateType::LifetimeDiamondMember => "lifetime_diamond",
            AccessGateType::UniquePerson => "unique_person",
            AccessGateType::VerifiedCredential => "verified_credential",
            AccessGateType::SnsNeuron => "sns_neuron",
            AccessGateType::Payment => "payment",
            AccessGateType::TokenBalance => "token_balance",
            AccessGateType::Composite => "composite",
            AccessGateType::Locked => "locked",
            AccessGateType::ReferredByMember => "referred_by_member",
        };

        f.write_str(str)
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum AccessGateNonComposite {
    DiamondMember,
    LifetimeDiamondMember,
    UniquePerson,
    VerifiedCredential(VerifiedCredentialGate),
    SnsNeuron(SnsNeuronGate),
    Payment(PaymentGate),
    TokenBalance(TokenBalanceGate),
    Locked,
    ReferredByMember,
}

pub enum AccessGateScope {
    Composite(CompositeGate),
    NonComposite(AccessGateNonComposite),
}

#[derive(Serialize, Deserialize, Eq, PartialEq)]
pub enum AccessGateExpiryBehaviour {
    UserLookup,
    Check,
    Lapse,
    Invalid,
}

impl From<AccessGate> for AccessGateScope {
    fn from(value: AccessGate) -> Self {
        match value {
            AccessGate::Composite(gate) => AccessGateScope::Composite(gate),
            AccessGate::DiamondMember => AccessGateScope::NonComposite(AccessGateNonComposite::DiamondMember),
            AccessGate::LifetimeDiamondMember => AccessGateScope::NonComposite(AccessGateNonComposite::LifetimeDiamondMember),
            AccessGate::UniquePerson => AccessGateScope::NonComposite(AccessGateNonComposite::UniquePerson),
            AccessGate::VerifiedCredential(gate) => {
                AccessGateScope::NonComposite(AccessGateNonComposite::VerifiedCredential(gate))
            }
            AccessGate::SnsNeuron(gate) => AccessGateScope::NonComposite(AccessGateNonComposite::SnsNeuron(gate)),
            AccessGate::Payment(gate) => AccessGateScope::NonComposite(AccessGateNonComposite::Payment(gate)),
            AccessGate::TokenBalance(gate) => AccessGateScope::NonComposite(AccessGateNonComposite::TokenBalance(gate)),
            AccessGate::Locked => AccessGateScope::NonComposite(AccessGateNonComposite::Locked),
            AccessGate::ReferredByMember => AccessGateScope::NonComposite(AccessGateNonComposite::ReferredByMember),
        }
    }
}

impl From<&AccessGate> for AccessGateExpiryBehaviour {
    fn from(value: &AccessGate) -> Self {
        if let AccessGate::Composite(gate) = value {
            if gate.inner.is_empty() {
                return AccessGateExpiryBehaviour::Invalid;
            }

            if gate.and {
                // If any immediately lapse then return lapse
                if gate
                    .inner
                    .iter()
                    .any(|g| matches!(AccessGateExpiryBehaviour::from(g), AccessGateExpiryBehaviour::Lapse))
                {
                    return AccessGateExpiryBehaviour::Lapse;
                }

                // If there are any user lookups then return user lookup
                if gate
                    .inner
                    .iter()
                    .any(|g| matches!(AccessGateExpiryBehaviour::from(g), AccessGateExpiryBehaviour::UserLookup))
                {
                    return AccessGateExpiryBehaviour::UserLookup;
                }

                AccessGateExpiryBehaviour::Check
            } else {
                // If there are any "user lookups" then return user lookup
                if gate
                    .inner
                    .iter()
                    .any(|g| matches!(AccessGateExpiryBehaviour::from(g), AccessGateExpiryBehaviour::UserLookup))
                {
                    return AccessGateExpiryBehaviour::UserLookup;
                }

                // If there are any "checks" then return check
                if gate
                    .inner
                    .iter()
                    .any(|g| matches!(AccessGateExpiryBehaviour::from(g), AccessGateExpiryBehaviour::Check))
                {
                    return AccessGateExpiryBehaviour::Check;
                }

                AccessGateExpiryBehaviour::Lapse
            }
        } else {
            AccessGateType::from(value).into()
        }
    }
}

impl From<AccessGateType> for AccessGateExpiryBehaviour {
    fn from(value: AccessGateType) -> Self {
        match value {
            AccessGateType::DiamondMember | AccessGateType::LifetimeDiamondMember | AccessGateType::UniquePerson => {
                AccessGateExpiryBehaviour::UserLookup
            }
            AccessGateType::Payment | AccessGateType::VerifiedCredential => AccessGateExpiryBehaviour::Lapse,
            AccessGateType::SnsNeuron | AccessGateType::TokenBalance => AccessGateExpiryBehaviour::Check,
            _ => AccessGateExpiryBehaviour::Invalid,
        }
    }
}

impl From<&AccessGate> for AccessGateType {
    fn from(value: &AccessGate) -> Self {
        match value {
            AccessGate::DiamondMember => AccessGateType::DiamondMember,
            AccessGate::LifetimeDiamondMember => AccessGateType::LifetimeDiamondMember,
            AccessGate::UniquePerson => AccessGateType::UniquePerson,
            AccessGate::VerifiedCredential(_) => AccessGateType::VerifiedCredential,
            AccessGate::SnsNeuron(_) => AccessGateType::SnsNeuron,
            AccessGate::Payment(_) => AccessGateType::Payment,
            AccessGate::TokenBalance(_) => AccessGateType::TokenBalance,
            AccessGate::Composite(_) => AccessGateType::Composite,
            AccessGate::Locked => AccessGateType::Locked,
            AccessGate::ReferredByMember => AccessGateType::ReferredByMember,
        }
    }
}

impl From<&AccessGateNonComposite> for AccessGateType {
    fn from(value: &AccessGateNonComposite) -> Self {
        match value {
            AccessGateNonComposite::DiamondMember => AccessGateType::DiamondMember,
            AccessGateNonComposite::LifetimeDiamondMember => AccessGateType::LifetimeDiamondMember,
            AccessGateNonComposite::UniquePerson => AccessGateType::UniquePerson,
            AccessGateNonComposite::VerifiedCredential(_) => AccessGateType::VerifiedCredential,
            AccessGateNonComposite::SnsNeuron(_) => AccessGateType::SnsNeuron,
            AccessGateNonComposite::Payment(_) => AccessGateType::Payment,
            AccessGateNonComposite::TokenBalance(_) => AccessGateType::TokenBalance,
            AccessGateNonComposite::Locked => AccessGateType::Locked,
            AccessGateNonComposite::ReferredByMember => AccessGateType::ReferredByMember,
        }
    }
}

impl From<&AccessGateNonComposite> for AccessGateExpiryBehaviour {
    fn from(value: &AccessGateNonComposite) -> Self {
        let gate_type: AccessGateType = value.into();
        gate_type.into()
    }
}

impl AccessGateConfig {
    pub fn validate(&self, test_mode: bool) -> bool {
        pub const DAY_IN_MS: Milliseconds = 1000 * 60 * 60 * 24;

        if let Some(expiry) = self.expiry {
            if !test_mode && expiry < DAY_IN_MS {
                return false;
            }

            let expiry_type: AccessGateExpiryBehaviour = (&self.gate).into();

            if matches!(expiry_type, AccessGateExpiryBehaviour::Invalid) {
                return false;
            }
        }

        self.gate.validate()
    }
}

impl AccessGate {
    pub fn validate(&self) -> bool {
        if let AccessGate::Composite(g) = self {
            if g.inner.is_empty() || g.inner.len() > 10 {
                return false;
            }
        }
        true
    }

    pub fn is_payment_gate(&self) -> bool {
        matches!(self, AccessGate::Payment(_))
    }

    pub fn gate_type(&self) -> AccessGateType {
        self.into()
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct VerifiedCredentialGate {
    pub issuer_canister_id: CanisterId,
    pub issuer_origin: String,
    pub credential_type: String,
    pub credential_name: String,
    pub credential_arguments: HashMap<String, VerifiedCredentialArgumentValue>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum VerifiedCredentialArgumentValue {
    String(String),
    Int(i32),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct SnsNeuronGate {
    pub governance_canister_id: CanisterId,
    pub min_stake_e8s: Option<u64>,
    pub min_dissolve_delay: Option<Milliseconds>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct PaymentGate {
    pub ledger_canister_id: CanisterId,
    pub amount: u128,
    pub fee: u128,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct TokenBalanceGate {
    pub ledger_canister_id: CanisterId,
    pub min_balance: u128,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct CompositeGate {
    pub inner: Vec<AccessGateNonComposite>,
    pub and: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum GateCheckFailedReason {
    NotDiamondMember,
    NotLifetimeDiamondMember,
    NoUniquePersonProof,
    NoSnsNeuronsFound,
    NoSnsNeuronsWithRequiredStakeFound,
    NoSnsNeuronsWithRequiredDissolveDelayFound,
    PaymentFailed(TransferFromError),
    InsufficientBalance(u128),
    FailedVerifiedCredentialCheck(String),
    Locked,
    NotReferredByMember,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct VerifiedCredentialGateArgs {
    pub user_ii_principal: Principal,
    pub credential_jwt: String,
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
