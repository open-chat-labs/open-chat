use crate::guards::caller_is_service_owner;
use crate::{mutate_state, read_state};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use proposals_bot_canister::add_governance_canister::{Response::*, *};
use std::fmt::Write;
use types::{ChatId, GroupPermissions, PermissionRole};

// dfx --identity openchat canister --network ic call proposals_bot add_governance_canister '(record { governance_canister_id=principal "rrkah-fqaaa-aaaaa-aaaaq-cai"; name="NNS" })'
#[update(guard = "caller_is_service_owner")]
#[trace]
async fn add_governance_canister(args: Args) -> Response {
    if read_state(|state| state.data.nervous_systems.exists(&args.governance_canister_id)) {
        return AlreadyAdded;
    }

    let chat_id = match create_group(&args).await {
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
