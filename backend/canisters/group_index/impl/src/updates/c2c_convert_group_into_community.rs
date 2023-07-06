use crate::guards::caller_is_group_canister;
use crate::updates::c2c_create_community::create_community_impl;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_convert_group_into_community::{Response::*, *};
use types::{CanisterId, SourceGroup};

#[update_msgpack(guard = "caller_is_group_canister")]
#[trace]
async fn c2c_convert_group_into_community(args: Args) -> Response {
    let PrepareResult {
        local_group_index_canister,
        create_community_args,
    } = match mutate_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let public = create_community_args.is_public;
    let name = create_community_args.name.clone();

    match create_community_impl(create_community_args, local_group_index_canister).await {
        Ok(community_id) => {
            if public {
                mutate_state(|state| {
                    // Assign the name to the community rather than the group
                    state.data.public_group_and_community_names.insert(&name, community_id.into());
                });
            }
            Success(community_id)
        }
        Err(error) => InternalError(error),
    }
}

struct PrepareResult {
    pub local_group_index_canister: CanisterId,
    pub create_community_args: local_group_index_canister::c2c_create_community::Args,
}

fn prepare(args: Args, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller().into();

    let local_group_index_canister = match state.data.local_index_map.index_for_new_canister() {
        Some(canister) => canister,
        None => return Err(InternalError("No available LocalGroupIndex found".to_string())),
    };

    let is_public = state.data.public_groups.get(&caller).is_some();

    let create_community_args = local_group_index_canister::c2c_create_community::Args {
        created_by_user_id: args.user_id,
        created_by_user_principal: args.user_principal,
        is_public,
        name: args.name.clone(),
        description: args.description,
        rules: args.rules,
        avatar: None,
        banner: None,
        history_visible_to_new_joiners: args.history_visible_to_new_joiners,
        permissions: args.permissions,
        gate: args.gate,
        default_channels: Vec::new(),
        source_group: Some(SourceGroup {
            group_id: caller,
            channel_id: args.channel_id,
            total_bytes: args.total_bytes,
        }),
        primary_language: args.primary_language,
    };

    Ok(PrepareResult {
        local_group_index_canister,
        create_community_args,
    })
}
