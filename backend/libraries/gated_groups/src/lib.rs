use candid::Principal;
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use sns_governance_canister::types::neuron::DissolveState;
use sns_governance_canister::types::Neuron;
use types::{
    AccessGate, CanisterId, GateCheckFailedReason, PaymentGate, SnsNeuronGate, TimestampNanos, UserId, VerifiedCredentialGate,
};
use user_index_canister_c2c_client::LookupUserError;
use utils::consts::MEMO_JOINING_FEE;

pub enum CheckIfPassesGateResult {
    Success,
    Failed(GateCheckFailedReason),
    InternalError(String),
}

pub struct CheckGateArgs {
    pub gate: AccessGate,
    pub user_index_canister: CanisterId,
    pub user_id: UserId,
    pub this_canister: CanisterId,
    pub now_nanos: TimestampNanos,
}

pub async fn check_if_passes_gate(args: CheckGateArgs) -> CheckIfPassesGateResult {
    match args.gate {
        AccessGate::VerifiedCredential(g) => check_verified_credential_gate(&g, args.user_id).await,
        AccessGate::DiamondMember => check_diamond_member_gate(args.user_id, args.user_index_canister).await,
        AccessGate::SnsNeuron(g) => check_sns_neuron_gate(&g, args.user_id).await,
        AccessGate::Payment(g) => try_transfer_from(&g, args.user_id, args.this_canister, args.now_nanos).await,
    }
}

async fn check_diamond_member_gate(user_id: UserId, user_index_canister_id: CanisterId) -> CheckIfPassesGateResult {
    match user_index_canister_c2c_client::lookup_user(user_id.into(), user_index_canister_id).await {
        Ok(user) if user.is_diamond_member => CheckIfPassesGateResult::Success,
        Ok(_) => CheckIfPassesGateResult::Failed(GateCheckFailedReason::NotDiamondMember),
        Err(error) => {
            let msg = match error {
                LookupUserError::UserNotFound => "User not found".to_string(),
                LookupUserError::InternalError(m) => m,
            };
            CheckIfPassesGateResult::InternalError(msg)
        }
    }
}

async fn check_verified_credential_gate(_gate: &VerifiedCredentialGate, _user_id: UserId) -> CheckIfPassesGateResult {
    CheckIfPassesGateResult::Success
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
    now_nanos: TimestampNanos,
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
            created_at_time: Some(now_nanos),
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

fn dissolve_delay_seconds(neuron: &Neuron, now_seconds: u64) -> u64 {
    match neuron.dissolve_state {
        Some(DissolveState::DissolveDelaySeconds(d)) => d,
        Some(DissolveState::WhenDissolvedTimestampSeconds(ts)) => ts.saturating_sub(now_seconds),
        None => 0,
    }
}
