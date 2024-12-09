use candid::Principal;
// use ic_verifiable_credentials::issuer_api::{ArgumentValue, CredentialSpec};
// use ic_verifiable_credentials::VcFlowSigners;
use constants::{DAY_IN_MS, MEMO_JOINING_FEE, NANOS_PER_MILLISECOND};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use sns_governance_canister::types::neuron::DissolveState;
use sns_governance_canister::types::Neuron;
use types::{
    AccessGate, AccessGateNonComposite, AccessGateScope, CanisterId, CompositeGate, GateCheckFailedReason, PaymentGate,
    SnsNeuronGate, TimestampMillis, TokenBalanceGate, UserId, VerifiedCredentialGate,
};

pub enum CheckIfPassesGateResult {
    Success(Vec<GatePayment>),
    Failed(GateCheckFailedReason),
    InternalError(String),
}

pub struct GatePayment {
    pub ledger_canister_id: CanisterId,
    pub amount: u128,
    pub fee: u128,
}

impl CheckIfPassesGateResult {
    pub fn success(&self) -> bool {
        matches!(self, CheckIfPassesGateResult::Success(_))
    }
}

#[derive(Clone)]
pub struct CheckGateArgs {
    pub user_id: UserId,
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    pub this_canister: CanisterId,
    pub is_unique_person: bool,
    pub verified_credential_args: Option<CheckVerifiedCredentialGateArgs>,
    pub referred_by_member: bool,
    pub now: TimestampMillis,
}

#[derive(Clone)]
pub struct CheckVerifiedCredentialGateArgs {
    pub user_ii_principal: Principal,
    pub credential_jwts: Vec<String>,
    pub ic_root_key: Vec<u8>,
    pub ii_canister_id: CanisterId,
    pub ii_origin: String,
}

pub async fn check_if_passes_gate(gate: AccessGate, args: CheckGateArgs) -> CheckIfPassesGateResult {
    match AccessGateScope::from(gate) {
        AccessGateScope::Composite(gate) => check_composite_gate(gate, args).await,
        AccessGateScope::NonComposite(gate) => check_non_composite_gate(gate, args).await,
    }
}

pub fn check_if_passes_gate_synchronously(gate: AccessGate, args: CheckGateArgs) -> Option<CheckIfPassesGateResult> {
    match AccessGateScope::from(gate) {
        AccessGateScope::Composite(gate) => check_composite_gate_synchronously(gate, args),
        AccessGateScope::NonComposite(gate) => check_non_composite_gate_synchronously(gate, args),
    }
}

async fn check_non_composite_gate(gate: AccessGateNonComposite, args: CheckGateArgs) -> CheckIfPassesGateResult {
    match gate {
        AccessGateNonComposite::DiamondMember => check_diamond_member_gate(args.diamond_membership_expires_at, args.now),
        AccessGateNonComposite::LifetimeDiamondMember => {
            check_lifetime_diamond_member_gate(args.diamond_membership_expires_at, args.now)
        }
        AccessGateNonComposite::UniquePerson => check_unique_person_gate(args.is_unique_person),
        AccessGateNonComposite::VerifiedCredential(g) => {
            check_verified_credential_gate(&g, args.verified_credential_args, args.now)
        }
        AccessGateNonComposite::SnsNeuron(g) => check_sns_neuron_gate(&g, args.user_id).await,
        AccessGateNonComposite::Payment(g) => try_transfer_from(&g, args.user_id, args.this_canister, args.now).await,
        AccessGateNonComposite::TokenBalance(g) => check_token_balance_gate(&g, args.user_id).await,
        AccessGateNonComposite::Locked => CheckIfPassesGateResult::Failed(GateCheckFailedReason::Locked),
        AccessGateNonComposite::ReferredByMember => check_referred_by_member_gate(args.referred_by_member),
    }
}

fn check_non_composite_gate_synchronously(
    gate: AccessGateNonComposite,
    args: CheckGateArgs,
) -> Option<CheckIfPassesGateResult> {
    match gate {
        AccessGateNonComposite::DiamondMember => Some(check_diamond_member_gate(args.diamond_membership_expires_at, args.now)),
        AccessGateNonComposite::LifetimeDiamondMember => Some(check_lifetime_diamond_member_gate(
            args.diamond_membership_expires_at,
            args.now,
        )),
        AccessGateNonComposite::UniquePerson => Some(check_unique_person_gate(args.is_unique_person)),
        AccessGateNonComposite::VerifiedCredential(g) => {
            Some(check_verified_credential_gate(&g, args.verified_credential_args, args.now))
        }
        AccessGateNonComposite::ReferredByMember => Some(check_referred_by_member_gate(args.referred_by_member)),
        _ => None,
    }
}

fn check_referred_by_member_gate(referred_by_member: bool) -> CheckIfPassesGateResult {
    if referred_by_member {
        CheckIfPassesGateResult::Success(Vec::new())
    } else {
        CheckIfPassesGateResult::Failed(GateCheckFailedReason::NotReferredByMember)
    }
}

fn check_diamond_member_gate(
    diamond_membership_expires_at: Option<TimestampMillis>,
    now: TimestampMillis,
) -> CheckIfPassesGateResult {
    if diamond_membership_expires_at > Some(now) {
        CheckIfPassesGateResult::Success(Vec::new())
    } else {
        CheckIfPassesGateResult::Failed(GateCheckFailedReason::NotDiamondMember)
    }
}

fn check_lifetime_diamond_member_gate(
    diamond_membership_expires_at: Option<TimestampMillis>,
    now: TimestampMillis,
) -> CheckIfPassesGateResult {
    // Check diamond membership expires in > 100 years
    if diamond_membership_expires_at > Some(now + 100 * 365 * DAY_IN_MS) {
        CheckIfPassesGateResult::Success(Vec::new())
    } else {
        CheckIfPassesGateResult::Failed(GateCheckFailedReason::NotLifetimeDiamondMember)
    }
}

fn check_unique_person_gate(is_unique_person: bool) -> CheckIfPassesGateResult {
    if is_unique_person {
        CheckIfPassesGateResult::Success(Vec::new())
    } else {
        CheckIfPassesGateResult::Failed(GateCheckFailedReason::NoUniquePersonProof)
    }
}

fn check_verified_credential_gate(
    _gate: &VerifiedCredentialGate,
    args: Option<CheckVerifiedCredentialGateArgs>,
    _now: TimestampMillis,
) -> CheckIfPassesGateResult {
    let Some(_args) = args else {
        return CheckIfPassesGateResult::Failed(GateCheckFailedReason::FailedVerifiedCredentialCheck(
            "Verified credential gate args not provided".to_string(),
        ));
    };

    CheckIfPassesGateResult::Success(Vec::new())

    // let vc_flow_signers = VcFlowSigners {
    //     ii_canister_id: args.ii_canister_id,
    //     ii_origin: args.ii_origin,
    //     issuer_canister_id: gate.issuer_canister_id,
    //     issuer_origin: gate.issuer_origin.clone(),
    // };
    //
    // let credential_spec = CredentialSpec {
    //     credential_type: gate.credential_type.clone(),
    //     arguments: Some(
    //         gate.credential_arguments
    //             .iter()
    //             .map(|(k, v)| {
    //                 (
    //                     k.clone(),
    //                     match v {
    //                         VerifiedCredentialArgumentValue::String(s) => ArgumentValue::String(s.clone()),
    //                         VerifiedCredentialArgumentValue::Int(i) => ArgumentValue::Int(*i),
    //                     },
    //                 )
    //             })
    //             .collect(),
    //     ),
    // };
    //
    // let now_nanos = (now * NANOS_PER_MILLISECOND) as u128;
    // if args.credential_jwts.iter().any(|jwt| {
    //     ic_verifiable_credentials::validate_ii_presentation_and_claims(
    //         jwt,
    //         args.user_ii_principal,
    //         &vc_flow_signers,
    //         &credential_spec,
    //         &args.ic_root_key,
    //         now_nanos,
    //     )
    //     .is_ok()
    // }) {
    //     CheckIfPassesGateResult::Success
    // } else {
    //     CheckIfPassesGateResult::Failed(GateCheckFailedReason::FailedVerifiedCredentialCheck(
    //         "No valid credential provided".to_string(),
    //     ))
    // }
}

async fn check_composite_gate(gate: CompositeGate, args: CheckGateArgs) -> CheckIfPassesGateResult {
    if let Some(result) = check_composite_gate_synchronously(gate.clone(), args.clone()) {
        return result;
    }

    let count = gate.inner.len();
    let mut all_transfers = Vec::new();
    for (index, inner) in gate.inner.into_iter().enumerate() {
        let last = index + 1 == count;
        match check_non_composite_gate(inner, args.clone()).await {
            CheckIfPassesGateResult::Success(transfers) => {
                all_transfers.extend(transfers);
                if !gate.and || last {
                    return CheckIfPassesGateResult::Success(all_transfers);
                }
            }
            result => {
                if gate.and || last {
                    return result;
                }
            }
        }
    }

    CheckIfPassesGateResult::InternalError("This shouldn't be possible".to_string())
}

fn check_composite_gate_synchronously(gate: CompositeGate, args: CheckGateArgs) -> Option<CheckIfPassesGateResult> {
    let count = gate.inner.len();
    let mut any_require_async = false;
    for (index, inner) in gate.inner.into_iter().enumerate() {
        let last = index + 1 == count;
        if let Some(result) = check_non_composite_gate_synchronously(inner, args.clone()) {
            let success = result.success();

            if (gate.and && !success) || (!gate.and && success) || (last && !any_require_async) {
                return Some(result);
            }
        } else {
            any_require_async = true;
        }

        if last && any_require_async {
            return None;
        }
    }

    Some(CheckIfPassesGateResult::InternalError(
        "This shouldn't be possible".to_string(),
    ))
}

async fn check_sns_neuron_gate(gate: &SnsNeuronGate, user_id: UserId) -> CheckIfPassesGateResult {
    let args = sns_governance_canister::list_neurons::Args {
        limit: 10,
        start_page_at: None,
        of_principal: Some(Principal::from(user_id)),
    };

    match sns_governance_canister_c2c_client::list_neurons(gate.governance_canister_id, &args).await {
        Ok(response) if response.neurons.is_empty() => {
            CheckIfPassesGateResult::Failed(GateCheckFailedReason::NoSnsNeuronsFound)
        }
        Ok(response) => {
            let mut valid_neurons = response.neurons;
            if let Some(dd) = gate.min_dissolve_delay {
                let now = canister_time::now_millis();
                valid_neurons.retain(|n| dissolve_delay_seconds(n, now / 1000) > (dd / 1000));
            }

            if valid_neurons.is_empty() {
                return CheckIfPassesGateResult::Failed(GateCheckFailedReason::NoSnsNeuronsWithRequiredDissolveDelayFound);
            }

            if let Some(stake_required) = gate.min_stake_e8s {
                let total_stake: u64 = valid_neurons
                    .iter()
                    .map(|n| n.cached_neuron_stake_e8s + n.staked_maturity_e8s_equivalent.unwrap_or_default())
                    .sum();

                if total_stake < stake_required {
                    return CheckIfPassesGateResult::Failed(GateCheckFailedReason::NoSnsNeuronsWithRequiredStakeFound);
                }
            }

            CheckIfPassesGateResult::Success(Vec::new())
        }
        Err(error) => CheckIfPassesGateResult::InternalError(format!("Error calling 'list_neurons': {error:?}")),
    }
}

async fn try_transfer_from(
    gate: &PaymentGate,
    user_id: UserId,
    this_canister_id: CanisterId,
    now: TimestampMillis,
) -> CheckIfPassesGateResult {
    let from: Principal = user_id.into();
    let amount = gate.amount - 2 * gate.fee;
    let transfer_args = TransferFromArgs {
        spender_subaccount: None,
        from: from.into(),
        to: this_canister_id.into(),
        // The amount the gate amount less the approval fee and the transfer_from fee
        amount: amount.into(),
        fee: Some(gate.fee.into()),
        memo: Some(MEMO_JOINING_FEE.to_vec().into()),
        created_at_time: Some(now * NANOS_PER_MILLISECOND),
    };
    match icrc_ledger_canister_c2c_client::icrc2_transfer_from(gate.ledger_canister_id, &transfer_args).await {
        Ok(Ok(_)) => CheckIfPassesGateResult::Success(vec![GatePayment {
            ledger_canister_id: gate.ledger_canister_id,
            amount: gate.amount,
            fee: gate.fee,
        }]),
        Ok(Err(err)) => CheckIfPassesGateResult::Failed(GateCheckFailedReason::PaymentFailed(err)),
        Err(error) => CheckIfPassesGateResult::InternalError(format!("Error calling 'try_transfer_from': {error:?}")),
    }
}

async fn check_token_balance_gate(gate: &TokenBalanceGate, user_id: UserId) -> CheckIfPassesGateResult {
    match icrc_ledger_canister_c2c_client::icrc1_balance_of(gate.ledger_canister_id, &Account::from(user_id)).await {
        Ok(balance) if balance >= gate.min_balance => CheckIfPassesGateResult::Success(Vec::new()),
        Ok(balance) => {
            CheckIfPassesGateResult::Failed(GateCheckFailedReason::InsufficientBalance(balance.0.try_into().unwrap()))
        }
        Err(error) => CheckIfPassesGateResult::InternalError(format!("Error calling 'icrc1_balance_of': {error:?}")),
    }
}

fn dissolve_delay_seconds(neuron: &Neuron, now_seconds: u64) -> u64 {
    match neuron.dissolve_state {
        Some(DissolveState::DissolveDelaySeconds(d)) => d,
        Some(DissolveState::WhenDissolvedTimestampSeconds(ts)) => ts.saturating_sub(now_seconds),
        None => 0,
    }
}
