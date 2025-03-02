use crate::updates::add_token::add_sns_token;
use crate::{mutate_state, read_state};
use constants::HOUR_IN_MS;
use ic_cdk::api::management_canister::main::CanisterId;
use ic_cdk::call::RejectCode;
use registry_canister::NervousSystemDetails;
use sns_governance_canister::types::governance::SnsMetadata;
use sns_governance_canister::types::NervousSystemParameters;
use sns_wasm_canister::list_deployed_snses::DeployedSns;
use std::collections::HashSet;
use std::time::Duration;
use tracing::{error, info};
use types::{Empty, TimestampMillis};
use utils::canister_timers::run_now_then_interval;

const LIFECYCLE_COMMITTED: i32 = 3;
const LIFECYCLE_ABORTED: i32 = 4;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(HOUR_IN_MS), run);
}

fn run() {
    ic_cdk::futures::spawn(run_async());
}

async fn run_async() {
    let sns_wasm_canister_id = read_state(|state| state.data.sns_wasm_canister_id);

    if let Ok(response) = sns_wasm_canister_c2c_client::list_deployed_snses(sns_wasm_canister_id, &Empty {}).await {
        let (launched_snses, failed_snses): (HashSet<_>, HashSet<_>) = read_state(|state| {
            let launched = state
                .data
                .nervous_systems
                .get_all()
                .iter()
                .map(|ns| ns.root_canister_id)
                .collect();

            let failed = state.data.failed_sns_launches.clone();

            (launched, failed)
        });

        for sns in response.instances {
            let root_canister_id = sns.root_canister_id.unwrap();
            if failed_snses.contains(&root_canister_id) {
                continue;
            }
            if launched_snses.contains(&root_canister_id) {
                if let Ok((metadata, parameters)) =
                    get_nervous_system_metadata_and_parameters(sns.governance_canister_id.unwrap()).await
                {
                    if mutate_state(|state| {
                        state
                            .data
                            .nervous_systems
                            .update(root_canister_id, metadata, parameters, state.env.now())
                    }) {
                        info!(%root_canister_id, "SNS details updated");
                    }
                }
            } else {
                info!(%root_canister_id, "Getting details of unknown SNS");
                if let Some(success) = is_successfully_launched(sns.swap_canister_id.unwrap()).await {
                    if success {
                        if let Ok(nervous_system) = get_nervous_system_details(sns).await {
                            add_sns_token(nervous_system).await;
                        }
                    } else {
                        info!(%root_canister_id, "Recording failed SNS launch");
                        mutate_state(|state| state.data.failed_sns_launches.insert(root_canister_id));
                    }
                }
            }
        }
    }
}

async fn is_successfully_launched(sns_swap_canister_id: CanisterId) -> Option<bool> {
    let response = sns_swap_canister_c2c_client::get_lifecycle(sns_swap_canister_id, &Empty {})
        .await
        .ok()?;

    match response.lifecycle? {
        LIFECYCLE_COMMITTED => Some(true),
        LIFECYCLE_ABORTED => Some(false),
        _ => None,
    }
}

async fn get_nervous_system_metadata_and_parameters(
    governance_canister_id: CanisterId,
) -> Result<(SnsMetadata, NervousSystemParameters), (RejectCode, String)> {
    futures::future::try_join(
        sns_governance_canister_c2c_client::get_metadata(governance_canister_id, &Empty {}),
        sns_governance_canister_c2c_client::get_nervous_system_parameters(governance_canister_id, &()),
    )
    .await
}

async fn get_nervous_system_details(sns: DeployedSns) -> Result<NervousSystemDetails, (RejectCode, String)> {
    let (metadata, parameters) = get_nervous_system_metadata_and_parameters(sns.governance_canister_id.unwrap()).await?;

    let now = read_state(|state| state.env.now());

    match build_nervous_system_details(&sns, metadata, parameters, now) {
        Some(ns) => Ok(ns),
        None => {
            error!(?sns, "Unable to build NervousSystemDetails due to missing data");
            Err((
                RejectCode::CanisterError,
                "Unable to build NervousSystemDetails due to missing data".to_string(),
            ))
        }
    }
}

fn build_nervous_system_details(
    sns: &DeployedSns,
    metadata: SnsMetadata,
    parameters: NervousSystemParameters,
    now: TimestampMillis,
) -> Option<NervousSystemDetails> {
    Some(NervousSystemDetails {
        root_canister_id: sns.root_canister_id?,
        governance_canister_id: sns.governance_canister_id?,
        swap_canister_id: sns.swap_canister_id?,
        ledger_canister_id: sns.ledger_canister_id?,
        index_canister_id: sns.index_canister_id?,
        name: metadata.name?,
        url: metadata.url,
        logo: metadata.logo?,
        description: metadata.description,
        transaction_fee: parameters.transaction_fee_e8s?,
        min_dissolve_delay_to_vote: parameters.neuron_minimum_dissolve_delay_to_vote_seconds?,
        min_neuron_stake: parameters.neuron_minimum_stake_e8s?,
        proposal_rejection_fee: parameters.reject_cost_e8s?,
        is_nns: false,
        submitting_proposals_enabled: false,
        added: now,
        last_updated: now,
    })
}
