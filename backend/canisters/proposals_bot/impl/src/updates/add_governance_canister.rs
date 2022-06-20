use crate::guards::caller_is_service_owner;
use crate::nns_governance_client::ListProposalInfo;
use crate::{mutate_state, nns_governance_client, read_state};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use proposals_bot_canister::add_governance_canister::{Response::*, *};
use types::{CanisterId, ChatId, GroupPermissions, PermissionRole};

#[update(guard = "caller_is_service_owner")]
#[trace]
async fn add_governance_canister(args: Args) -> Response {
    if read_state(|state| state.data.nervous_systems.exists(&args.governance_canister_id)) {
        return AlreadyAdded;
    }

    let next_proposal_id = match get_next_proposal_id(args.governance_canister_id).await {
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

async fn get_next_proposal_id(governance_canister_id: CanisterId) -> Result<u64, Response> {
    let list_proposals_args = ListProposalInfo {
        limit: 1,
        before_proposal: None,
        exclude_topic: Vec::new(),
        include_reward_status: Vec::new(),
        include_status: Vec::new(),
    };

    match nns_governance_client::list_proposals(governance_canister_id, list_proposals_args).await {
        Ok(response) => Ok(response.into_iter().next().map_or(1, |p| p.proposal_id + 1)),
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
        description: "".to_string(),
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
