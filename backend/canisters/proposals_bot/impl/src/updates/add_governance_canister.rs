use crate::governance_clients::common::RawProposal;
use crate::governance_clients::sns::ListProposals;
use crate::governance_clients::{self, nns::ListProposalInfo};
use crate::guards::caller_is_service_owner;
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::update;
use proposals_bot_canister::add_governance_canister::{Response::*, *};
use std::fmt::Write;
use types::{CanisterId, ChatId, GroupPermissions, PermissionRole};

#[update(guard = "caller_is_service_owner")]
#[trace]
async fn add_governance_canister(args: Args) -> Response {
    let is_nns = match read_state(|state| prepare(&args, state)) {
        Ok(result) => result.is_nns,
        Err(response) => return response,
    };

    let next_proposal_id = match if is_nns {
        get_next_nns_proposal_id(args.governance_canister_id).await
    } else {
        get_next_sns_proposal_id(args.governance_canister_id).await
    } {
        Ok(id) => id,
        Err(response) => return response,
    };

    let chat_id = match create_group(&args).await {
        Ok(id) => id,
        Err(response) => return response,
    };

    mutate_state(|state| {
        state
            .data
            .nervous_systems
            .add(args.name, args.governance_canister_id, chat_id, next_proposal_id);
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
        let is_nns = args.governance_canister_id == runtime_state.data.nns_governance_canister_id;
        Ok(PrepareResult { is_nns })
    }
}

async fn get_next_nns_proposal_id(governance_canister_id: CanisterId) -> Result<u64, Response> {
    let list_proposals_args = ListProposalInfo {
        limit: 1,
        before_proposal: None,
        exclude_topic: Vec::new(),
        include_reward_status: Vec::new(),
        include_status: Vec::new(),
    };

    let response = governance_clients::nns::list_proposals(governance_canister_id, &list_proposals_args).await;
    handle_response(governance_canister_id, response)
}

async fn get_next_sns_proposal_id(governance_canister_id: CanisterId) -> Result<u64, Response> {
    let list_proposals_args = ListProposals {
        limit: 1,
        before_proposal: None,
        exclude_type: Vec::new(),
        include_reward_status: Vec::new(),
        include_status: Vec::new(),
    };

    let response = governance_clients::sns::list_proposals(governance_canister_id, &list_proposals_args).await;
    handle_response(governance_canister_id, response)
}

fn handle_response<R: RawProposal>(governance_canister_id: CanisterId, response: CallResult<Vec<R>>) -> Result<u64, Response> {
    match response {
        Ok(response) => Ok(response.into_iter().next().map_or(1, |p| p.id())),
        Err(error) => Err(InternalError(format!(
            "Error calling 'list_proposals' on canister '{}': {:?}",
            governance_canister_id, error
        ))),
    }
}

async fn create_group(args: &Args) -> Result<ChatId, Response> {
    let (group_index_canister_id, my_principal) =
        read_state(|state| (state.data.group_index_canister_id, state.env.canister_id()));

    let create_group_args = group_index_canister::c2c_create_group::Args {
        is_public: true,
        creator_principal: my_principal,
        name: format!("{} Proposals", &args.name),
        description: args.description.clone().unwrap_or_else(|| default_description(&args.name)),
        avatar: args.avatar.clone(),
        history_visible_to_new_joiners: true,
        permissions: Some(GroupPermissions {
            create_polls: PermissionRole::Admins,
            send_messages: PermissionRole::Admins,
            ..Default::default()
        }),
    };
    match group_index_canister_c2c_client::c2c_create_group(group_index_canister_id, &create_group_args).await {
        Ok(group_index_canister::c2c_create_group::Response::Success(result)) => Ok(result.chat_id),
        Ok(response) => Err(InternalError(format!("Unable to create group: {:?}", response))),
        Err(error) => Err(InternalError(format!(
            "Error calling 'c2c_create_group' on group_index: {:?}",
            error
        ))),
    }
}

fn default_description(name: &str) -> String {
    let mut description = String::new();
    writeln!(&mut description, "Join this group to view and vote on {name} proposals.").unwrap();
    writeln!(&mut description).unwrap();
    writeln!(
        &mut description,
        "To vote on proposals you must add your UserId as a hotkey to any {name} neurons you wish to vote with."
    )
    .unwrap();
    writeln!(&mut description).unwrap();
    writeln!(&mut description, "You can find your UserId on the 'About OpenChat' page.").unwrap();
    description
}
