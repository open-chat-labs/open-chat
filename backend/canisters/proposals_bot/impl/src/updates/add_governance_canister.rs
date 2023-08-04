use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use proposals_bot_canister::add_governance_canister::{Response::*, *};
use std::fmt::Write;
use types::{AccessRules, GovernanceProposalsSubtype, GroupPermissionRole, GroupPermissions, GroupSubtype, MultiUserChat};

// dfx --identity openchat canister --network ic call proposals_bot add_governance_canister '(record { governance_canister_id=principal "rrkah-fqaaa-aaaaa-aaaaq-cai"; name="NNS" })'
#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_governance_canister(args: Args) -> Response {
    let PrepareResult { is_nns } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let chat_id = match create_group_or_channel(&args, is_nns).await {
        Ok(id) => id,
        Err(response) => return response,
    };

    mutate_state(|state| {
        state.data.nervous_systems.add(args.governance_canister_id, chat_id);
    });

    Success
}

struct PrepareResult {
    is_nns: bool,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.nervous_systems.exists(&args.governance_canister_id) {
        Err(AlreadyAdded)
    } else {
        Ok(PrepareResult {
            is_nns: args.governance_canister_id == state.data.nns_governance_canister_id,
        })
    }
}

async fn create_group_or_channel(args: &Args, is_nns: bool) -> Result<MultiUserChat, Response> {
    if args.community_id.is_some() {
        create_channel(args, is_nns).await
    } else {
        create_group(args, is_nns).await
    }
}

async fn create_group(args: &Args, is_nns: bool) -> Result<MultiUserChat, Response> {
    let group_index_canister_id = read_state(|state| state.data.group_index_canister_id);

    let create_group_args = group_index_canister::c2c_create_group::Args {
        is_public: true,
        name: format!("{} Proposals", &args.name),
        description: args
            .description
            .clone()
            .unwrap_or_else(|| default_description(&args.name, false)),
        rules: AccessRules::default(),
        subtype: Some(GroupSubtype::GovernanceProposals(GovernanceProposalsSubtype {
            governance_canister_id: args.governance_canister_id,
            is_nns,
        })),
        avatar: args.avatar.clone(),
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
        Ok(group_index_canister::c2c_create_group::Response::Success(result)) => Ok(MultiUserChat::Group(result.chat_id)),
        Ok(response) => Err(InternalError(format!("Unable to create group: {response:?}"))),
        Err(error) => Err(InternalError(format!(
            "Error calling 'c2c_create_group' on group_index: {error:?}",
        ))),
    }
}

async fn create_channel(args: &Args, is_nns: bool) -> Result<MultiUserChat, Response> {
    let create_channel_args = community_canister::c2c_create_proposals_channel::Args {
        is_public: true,
        name: format!("{} Proposals", &args.name),
        description: args
            .description
            .clone()
            .unwrap_or_else(|| default_description(&args.name, true)),
        rules: AccessRules::default(),
        subtype: Some(GroupSubtype::GovernanceProposals(GovernanceProposalsSubtype {
            governance_canister_id: args.governance_canister_id,
            is_nns,
        })),
        avatar: args.avatar.clone(),
        history_visible_to_new_joiners: true,
        permissions: Some(GroupPermissions {
            create_polls: GroupPermissionRole::Admins,
            send_messages: GroupPermissionRole::Admins,
            ..Default::default()
        }),
        events_ttl: None,
        gate: None,
    };

    let community_id = args.community_id.unwrap();

    match community_canister_c2c_client::c2c_create_proposals_channel(community_id.into(), &create_channel_args).await {
        Ok(community_canister::c2c_create_proposals_channel::Response::Success(result)) => {
            Ok(MultiUserChat::Channel(community_id, result.channel_id))
        }
        Ok(response) => Err(InternalError(format!("Unable to create channel: {response:?}"))),
        Err(error) => Err(InternalError(format!(
            "Error calling 'create_channel' on community: {error:?}",
        ))),
    }
}

fn default_description(name: &str, is_channel: bool) -> String {
    let chat_type = if is_channel { "channel" } else { "group" };
    let mut description = String::new();
    writeln!(
        &mut description,
        "Join this {chat_type} to view and vote on {name} proposals."
    )
    .unwrap();
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
