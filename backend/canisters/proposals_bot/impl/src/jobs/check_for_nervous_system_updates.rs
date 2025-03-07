use crate::{jobs, mutate_state, read_state};
use constants::HOUR_IN_MS;
use registry_canister::NervousSystemDetails;
use std::fmt::Write;
use std::time::Duration;
use tracing::{error, info, trace};
use types::{
    CanisterId, GovernanceProposalsSubtype, GroupPermissionRole, GroupPermissions, GroupSubtype, MessagePermissions,
    MultiUserChat, Rules,
};
use utils::canister_timers::run_now_then_interval;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(HOUR_IN_MS), run);
}

fn run() {
    ic_cdk::futures::spawn(run_async());
}

async fn run_async() {
    let (registry_canister_id, registry_synced_up_to) =
        read_state(|state| (state.data.registry_canister_id, state.data.registry_synced_up_to));

    match registry_canister_c2c_client::c2c_nervous_systems(
        registry_canister_id,
        &registry_canister::c2c_nervous_systems::Args {
            updates_since: Some(registry_synced_up_to),
        },
    )
    .await
    {
        Ok(registry_canister::c2c_nervous_systems::Response::Success(result)) => {
            mutate_state(|state| {
                for ns in result.nervous_systems {
                    let governance_canister_id = ns.governance_canister_id;
                    if state.data.nervous_systems.exists(&governance_canister_id) {
                        info!(%governance_canister_id, "Updating nervous system");
                        state.data.nervous_systems.update_from_registry(ns);
                    } else {
                        info!(%governance_canister_id, "Creating group for nervous system");
                        ic_cdk::futures::spawn(create_group(ns, state.data.group_index_canister_id));
                    }
                }
                state.data.registry_synced_up_to = result.last_updated;
                info!(synced_up_to = result.last_updated, "Registry sync complete");
                jobs::increase_dissolve_delay::start_job_if_required(state);
            });
        }
        Ok(registry_canister::c2c_nervous_systems::Response::SuccessNoUpdates) => {
            trace!("No registry updates");
        }
        _ => {}
    }
}

async fn create_group(ns: NervousSystemDetails, group_index_canister_id: CanisterId) {
    let governance_canister_id = ns.governance_canister_id;
    let name = ns.name.clone();

    let create_group_args = group_index_canister::c2c_create_group::Args {
        is_public: true,
        name: format!("{} Proposals", name),
        description: default_description(&name),
        rules: Rules::default(),
        subtype: Some(GroupSubtype::GovernanceProposals(GovernanceProposalsSubtype {
            governance_canister_id,
            is_nns: ns.is_nns,
        })),
        avatar: None,
        history_visible_to_new_joiners: true,
        messages_visible_to_non_members: Some(true),
        permissions_v2: Some(GroupPermissions {
            message_permissions: MessagePermissions {
                default: GroupPermissionRole::Admins,
                ..Default::default()
            },
            thread_permissions: Some(MessagePermissions {
                default: GroupPermissionRole::Members,
                ..Default::default()
            }),
            ..Default::default()
        }),
        events_ttl: None,
        gate_config: None,
    };

    match group_index_canister_c2c_client::c2c_create_group(group_index_canister_id, &create_group_args).await {
        Ok(group_index_canister::c2c_create_group::Response::Success(result)) => {
            mutate_state(|state| {
                state.data.nervous_systems.add(ns, MultiUserChat::Group(result.chat_id));
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
