use crate::guards::caller_is_service_owner;
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use proposals_bot_canister::add_governance_canister::{Response::*, *};
use std::fmt::Write;
use types::{ChatId, GovernanceProposalsSubtype, GroupPermissions, GroupRules, GroupSubtype, PermissionRole};

// dfx --identity openchat canister --network ic call proposals_bot add_governance_canister '(record { governance_canister_id=principal "rrkah-fqaaa-aaaaa-aaaaq-cai"; name="NNS" })'
#[update(guard = "caller_is_service_owner")]
#[trace]
async fn add_governance_canister(args: Args) -> Response {
    let PrepareResult { is_nns } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let chat_id = match create_group(&args, is_nns).await {
        Ok(id) => id,
        Err(response) => return response,
    };

    mutate_state(|state| {
        state
            .data
            .nervous_systems
            .add(args.name, args.governance_canister_id, chat_id);
    });

    Success
}

struct PrepareResult {
    is_nns: bool,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    if runtime_state.data.nervous_systems.exists(&args.governance_canister_id) {
        Err(AlreadyAdded)
    } else {
        Ok(PrepareResult {
            is_nns: args.governance_canister_id == runtime_state.data.nns_governance_canister_id,
        })
    }
}

async fn create_group(args: &Args, is_nns: bool) -> Result<ChatId, Response> {
    let group_index_canister_id = read_state(|state| state.data.group_index_canister_id);

    let create_group_args = group_index_canister::c2c_create_group::Args {
        is_public: true,
        name: format!("{} Proposals", &args.name),
        description: args.description.clone().unwrap_or_else(|| default_description(&args.name)),
        rules: GroupRules::default(),
        subtype: Some(GroupSubtype::GovernanceProposals(GovernanceProposalsSubtype {
            governance_canister_id: args.governance_canister_id,
            is_nns,
        })),
        avatar: args.avatar.clone(),
        history_visible_to_new_joiners: true,
        permissions: Some(GroupPermissions {
            create_polls: PermissionRole::Admins,
            send_messages: PermissionRole::Admins,
            ..Default::default()
        }),
        events_ttl: None,
    };
    match group_index_canister_c2c_client::c2c_create_group(group_index_canister_id, &create_group_args).await {
        Ok(group_index_canister::c2c_create_group::Response::Success(result)) => Ok(result.chat_id),
        Ok(response) => Err(InternalError(format!("Unable to create group: {response:?}"))),
        Err(error) => Err(InternalError(format!(
            "Error calling 'c2c_create_group' on group_index: {error:?}",
        ))),
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
