use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use sns_governance_canister::types::neuron::DissolveState;
use sns_governance_canister::types::Neuron;
use types::{
    AccessGate, CanisterId, GateCheckFailedReason, PaymentGate, SnsNeuronGate, TimestampMillis, TokenBalanceGate, UserId,
    VerifiedCredentialArgumentValue, VerifiedCredentialGate,
};
use utils::consts::MEMO_JOINING_FEE;
use utils::time::NANOS_PER_MILLISECOND;
use vc_util::issuer_api::{ArgumentValue, CredentialSpec};
use vc_util::VcFlowSigners;

pub enum CheckIfPassesGateResult {
    Success,
    Failed(GateCheckFailedReason),
    InternalError(String),
}

pub struct CheckGateArgs {
    pub gate: AccessGate,
    pub user_id: UserId,
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    pub this_canister: CanisterId,
    pub verified_credential_args: Option<CheckVerifiedCredentialGateArgs>,
    pub now: TimestampMillis,
}

pub struct CheckVerifiedCredentialGateArgs {
    pub user_ii_principal: Principal,
    pub credential_jwt: String,
    pub ic_root_key: Vec<u8>,
    pub ii_canister_id: CanisterId,
    pub ii_origin: String,
}

pub async fn check_if_passes_gate(args: CheckGateArgs) -> CheckIfPassesGateResult {
    match args.gate {
        AccessGate::VerifiedCredential(g) => check_verified_credential_gate(&g, args.verified_credential_args, args.now).await,
        AccessGate::DiamondMember => check_diamond_member_gate(args.diamond_membership_expires_at, args.now),
        AccessGate::SnsNeuron(g) => check_sns_neuron_gate(&g, args.user_id).await,
        AccessGate::Payment(g) => try_transfer_from(&g, args.user_id, args.this_canister, args.now).await,
        AccessGate::TokenBalance(g) => check_token_balance_gate(&g, args.user_id).await,
    }
}

pub fn check_if_passes_gate_synchronously(args: CheckGateArgs) -> CheckIfPassesGateResult {
    match args.gate {
        AccessGate::DiamondMember => check_diamond_member_gate(args.diamond_membership_expires_at, args.now),
        _ => CheckIfPassesGateResult::InternalError("Gate check could not be performed synchronously".to_string()),
    }
}

fn check_diamond_member_gate(
    diamond_membership_expires_at: Option<TimestampMillis>,
    now: TimestampMillis,
) -> CheckIfPassesGateResult {
    if diamond_membership_expires_at > Some(now) {
        CheckIfPassesGateResult::Success
    } else {
        CheckIfPassesGateResult::Failed(GateCheckFailedReason::NotDiamondMember)
    }
}

async fn check_verified_credential_gate(
    gate: &VerifiedCredentialGate,
    args: Option<CheckVerifiedCredentialGateArgs>,
    now: TimestampMillis,
) -> CheckIfPassesGateResult {
    let Some(args) = args else {
        return CheckIfPassesGateResult::Failed(GateCheckFailedReason::FailedVerifiedCredentialCheck(
            "Verified credential gate args not provided".to_string(),
        ));
    };

    if let Err(error) = vc_util::validate_ii_presentation_and_claims(
        &args.credential_jwt,
        args.user_ii_principal,
        &VcFlowSigners {
            ii_canister_id: args.ii_canister_id,
            ii_origin: args.ii_origin,
            issuer_canister_id: gate.issuer_canister_id,
            issuer_origin: gate.issuer_origin.clone(),
        },
        &CredentialSpec {
            credential_type: gate.credential_type.clone(),
            arguments: Some(
                gate.credential_arguments
                    .iter()
                    .map(|(k, v)| {
                        (
                            k.clone(),
                            match v {
                                VerifiedCredentialArgumentValue::String(s) => ArgumentValue::String(s.clone()),
                                VerifiedCredentialArgumentValue::Int(i) => ArgumentValue::Int(*i),
                            },
                        )
                    })
                    .collect(),
            ),
        },
        &args.ic_root_key,
        (now * NANOS_PER_MILLISECOND) as u128,
    ) {
        CheckIfPassesGateResult::Failed(GateCheckFailedReason::FailedVerifiedCredentialCheck(format!("{error:?}")))
    } else {
        CheckIfPassesGateResult::Success
    }
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
                let now = utils::time::now_millis();
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

            CheckIfPassesGateResult::Success
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
    match icrc_ledger_canister_c2c_client::icrc2_transfer_from(
        gate.ledger_canister_id,
        &TransferFromArgs {
            spender_subaccount: None,
            from: from.into(),
            to: this_canister_id.into(),
            // The amount the gate amount less the approval fee and the transfer_from fee
            amount: (gate.amount - 2 * gate.fee).into(),
            fee: Some(gate.fee.into()),
            memo: Some(MEMO_JOINING_FEE.to_vec().into()),
            created_at_time: Some(now * NANOS_PER_MILLISECOND),
        },
    )
    .await
    {
        Ok(icrc_ledger_canister::icrc2_transfer_from::Response::Ok(_)) => CheckIfPassesGateResult::Success,
        Ok(icrc_ledger_canister::icrc2_transfer_from::Response::Err(err)) => {
            CheckIfPassesGateResult::Failed(GateCheckFailedReason::PaymentFailed(err))
        }
        Err(error) => CheckIfPassesGateResult::InternalError(format!("Error calling 'try_transfer_from': {error:?}")),
    }
}

async fn check_token_balance_gate(gate: &TokenBalanceGate, user_id: UserId) -> CheckIfPassesGateResult {
    match icrc_ledger_canister_c2c_client::icrc1_balance_of(gate.ledger_canister_id, &Account::from(user_id)).await {
        Ok(balance) if balance >= gate.min_balance => CheckIfPassesGateResult::Success,
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
