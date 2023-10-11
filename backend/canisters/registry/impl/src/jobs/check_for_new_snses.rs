use crate::model::nervous_systems::NervousSystemDetails;
use crate::updates::add_token::add_sns_token;
use crate::{mutate_state, read_state};
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk::api::management_canister::main::CanisterId;
use sns_wasm_canister::list_deployed_snses::DeployedSns;
use std::collections::HashSet;
use std::time::Duration;
use tracing::{error, info};
use types::{Empty, TimestampMillis};
use utils::time::HOUR_IN_MS;

const LIFECYCLE_COMMITTED: i32 = 3;
const LIFECYCLE_ABORTED: i32 = 4;

pub fn start_job() {
    ic_cdk_timers::set_timer_interval(Duration::from_millis(HOUR_IN_MS), run);
    ic_cdk_timers::set_timer(Duration::ZERO, run);
}

fn run() {
    ic_cdk::spawn(run_async());
}

async fn run_async() {
    let sns_wasm_canister_id = read_state(|state| state.data.sns_wasm_canister_id);

    if let Ok(response) = sns_wasm_canister_c2c_client::list_deployed_snses(sns_wasm_canister_id, &Empty {}).await {
        let unknown_snses: Vec<_> = read_state(|state| {
            let known_snses: HashSet<_> = state
                .data
                .nervous_systems
                .get_all()
                .iter()
                .map(|ns| ns.root_canister_id)
                .chain(state.data.failed_sns_launches.iter().copied())
                .collect();

            response
                .instances
                .into_iter()
                .filter(|sns| !known_snses.contains(&sns.root_canister_id.unwrap()))
                .collect()
        });

        for sns in unknown_snses {
            let root_canister_id = sns.root_canister_id.unwrap();
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

async fn get_nervous_system_details(sns: DeployedSns) -> CallResult<NervousSystemDetails> {
    let metadata = sns_governance_canister_c2c_client::get_metadata(sns.governance_canister_id.unwrap(), &Empty {}).await?;
    let parameters =
        sns_governance_canister_c2c_client::get_nervous_system_parameters(sns.governance_canister_id.unwrap(), &()).await?;

    let now = read_state(|state| state.env.now());

    match build_nervous_system_details(&sns, metadata, parameters, now) {
        Some(ns) => Ok(ns),
        None => {
            error!(?sns, "Unable to build NervousSystemDetails due to missing data");
            Err((
                RejectionCode::Unknown,
                "Unable to build NervousSystemDetails due to missing data".to_string(),
            ))
        }
    }
}

fn build_nervous_system_details(
    sns: &DeployedSns,
    metadata: sns_governance_canister::get_metadata::Response,
    parameters: sns_governance_canister::get_nervous_system_parameters::Response,
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
        min_dissolve_delay_to_vote: parameters.neuron_minimum_dissolve_delay_to_vote_seconds?,
        min_neuron_stake: parameters.neuron_minimum_stake_e8s?,
        proposal_rejection_fee: parameters.reject_cost_e8s?,
        is_nns: false,
        added: now,
        last_updated: now,
    })
}
