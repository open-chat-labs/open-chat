use candid::Principal;
use types::{AccessGate, CanisterId, GateCheckFailedReason, SnsNeuronGate, UserId};
use user_index_canister_c2c_client::LookupUserError;

pub enum CheckIfPassesGateResult {
    Success,
    Failed(GateCheckFailedReason),
    InternalError(String),
}

pub async fn check_if_passes_gate(
    gate: &AccessGate,
    user_id: UserId,
    user_index_canister_id: CanisterId,
) -> CheckIfPassesGateResult {
    match gate {
        AccessGate::DiamondMember => check_diamond_member_gate(user_id, user_index_canister_id).await,
        AccessGate::SnsNeuron(g) => check_sns_neuron_gate(g, user_id).await,
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

async fn check_sns_neuron_gate(gate: &SnsNeuronGate, user_id: UserId) -> CheckIfPassesGateResult {
    let args = sns_governance_canister::list_neurons::Args {
        limit: 10,
        start_page_at: None,
        of_principal: Some(Principal::from(user_id).into()),
    };

    match sns_governance_canister_c2c_client::list_neurons(gate.governance_canister_id, &args).await {
        Ok(response) if response.neurons.is_empty() => {
            CheckIfPassesGateResult::Failed(GateCheckFailedReason::NoSnsNeuronsFound)
        }
        Ok(response) => {
            let mut valid_neurons = response.neurons;
            if let Some(dd) = gate.min_dissolve_delay {
                let now = utils::time::now_millis();
                valid_neurons.retain(|n| n.dissolve_delay_seconds(now / 1000) > (dd / 1000));
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
