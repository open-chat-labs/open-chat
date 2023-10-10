use crate::{mutate_state, read_state};
use std::fmt::Write;
use std::time::Duration;
use tracing::{error, info};
use types::{
    CanisterId, Empty, GovernanceProposalsSubtype, GroupPermissionRole, GroupPermissions, GroupSubtype, MultiUserChat, Rules,
};
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
        let new_snses: Vec<_> = read_state(|state| {
            response
                .instances
                .into_iter()
                .filter(|sns| {
                    !state.data.failed_sns_launches.contains(&sns.root_canister_id.unwrap())
                        && !state.data.nervous_systems.exists(&sns.governance_canister_id.unwrap())
                })
                .collect()
        });

        for sns in new_snses {
            let root_canister_id = sns.root_canister_id.unwrap();
            info!(%root_canister_id, "Getting details of unknown SNS");
            if let Some(success) = is_successfully_launched(sns.swap_canister_id.unwrap()).await {
                if success {
                    let governance_canister_id = sns.governance_canister_id.unwrap();
                    if let Ok(metadata) =
                        sns_governance_canister_c2c_client::get_metadata(governance_canister_id, &Empty {}).await
                    {
                        let name = metadata.name.unwrap();
                        ic_cdk::spawn(create_group(governance_canister_id, sns.ledger_canister_id.unwrap(), name));
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

async fn create_group(governance_canister_id: CanisterId, ledger_canister_id: CanisterId, name: String) {
    let (group_index_canister_id, is_nns) = read_state(|state| {
        (
            state.data.group_index_canister_id,
            governance_canister_id == state.data.nns_governance_canister_id,
        )
    });

    let create_group_args = group_index_canister::c2c_create_group::Args {
        is_public: true,
        name: format!("{} Proposals", name),
        description: default_description(&name),
        rules: Rules::default(),
        subtype: Some(GroupSubtype::GovernanceProposals(GovernanceProposalsSubtype {
            governance_canister_id,
            is_nns,
        })),
        avatar: None,
        history_visible_to_new_joiners: true,
        permissions: Some(GroupPermissions {
            create_polls: GroupPermissionRole::Admins,
            send_messages: GroupPermissionRole::Admins,
            ..Default::default()
        }),
        events_ttl: None,
        gate: None,
    };

    match group_index_canister_c2c_client::c2c_create_group(group_index_canister_id, &create_group_args).await {
        Ok(group_index_canister::c2c_create_group::Response::Success(result)) => {
            mutate_state(|state| {
                state.data.nervous_systems.add(
                    governance_canister_id,
                    ledger_canister_id,
                    MultiUserChat::Group(result.chat_id),
                );
            });
            info!(%governance_canister_id, name = name.as_str(), "Proposals group created");
        }
        response => error!(?response, %governance_canister_id, name = name.as_str(), "Failed to create proposals group"),
    }
}

fn default_description(name: &str) -> String {
    let mut description = String::new();
    writeln!(&mut description, "Join this group to view and vote on {name} proposals.").unwrap();
    writeln!(&mut description).unwrap();
    writeln!(
        &mut description,
        "To vote on proposals you must add your user id as a hotkey to any {name} neurons you wish to vote with."
    )
    .unwrap();
    writeln!(&mut description).unwrap();
    writeln!(&mut description, "Your OpenChat user id is {{userId}}.").unwrap();
    description
}
