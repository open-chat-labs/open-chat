use crate::model::private_communities::PrivateCommunityInfo;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_create_community::{Response::*, *};
use types::{CanisterId, CommunityId, Document, UserId};

#[update(msgpack = true)]
#[trace]
async fn c2c_create_community(args: Args) -> Response {
    let (user_id, principal) = match validate_caller().await {
        Ok((u, p)) => (u, p),
        Err(response) => return response,
    };

    let PrepareResult {
        local_group_index_canister,
    } = match mutate_state(|state| prepare(&args.name, args.is_public, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let c2c_create_community_args = local_group_index_canister::c2c_create_community::Args {
        created_by_user_id: user_id,
        created_by_user_principal: principal,
        is_public: args.is_public,
        name: args.name.clone(),
        description: args.description.clone(),
        rules: args.rules,
        avatar: args.avatar,
        banner: args.banner,
        history_visible_to_new_joiners: args.history_visible_to_new_joiners,
        permissions: args.permissions,
        gate_config: args.gate_config.clone(),
        default_channels: args.default_channels,
        default_channel_rules: args.default_channel_rules,
        source_group: None,
        primary_language: args.primary_language.clone(),
    };

    match create_community_impl(c2c_create_community_args, local_group_index_canister).await {
        Ok(result) => Success(SuccessResult {
            community_id: result.community_id,
            local_user_index_canister_id: result.local_user_index_canister_id,
        }),
        Err(error) => InternalError(error),
    }
}

pub(crate) async fn create_community_impl(
    args: local_group_index_canister::c2c_create_community::Args,
    local_group_index_canister: CanisterId,
) -> Result<local_group_index_canister::c2c_create_community::SuccessResult, String> {
    match local_group_index_canister_c2c_client::c2c_create_community(local_group_index_canister, &args).await {
        Ok(local_group_index_canister::c2c_create_community::Response::Success(result)) => {
            mutate_state(|state| commit(args, result.community_id, local_group_index_canister, state));
            Ok(result)
        }
        Ok(local_group_index_canister::c2c_create_community::Response::InternalError(error)) => {
            if args.is_public {
                mutate_state(|state| state.data.public_group_and_community_names.unreserve_name(&args.name));
            }
            Err(error)
        }
        Ok(local_group_index_canister::c2c_create_community::Response::Error(error)) => {
            if args.is_public {
                mutate_state(|state| state.data.public_group_and_community_names.unreserve_name(&args.name));
            }
            Err(format!("{error:?}"))
        }
        Err(error) => {
            if args.is_public {
                mutate_state(|state| state.data.public_group_and_community_names.unreserve_name(&args.name));
            }
            Err(format!("{error:?}"))
        }
    }
}

async fn validate_caller() -> Result<(UserId, Principal), Response> {
    let (caller, user_index_canister_id): (UserId, CanisterId) =
        read_state(|state| (state.env.caller().into(), state.data.user_index_canister_id));

    match user_index_canister_c2c_client::c2c_lookup_user(
        user_index_canister_id,
        &user_index_canister::c2c_lookup_user::Args {
            user_id_or_principal: caller.into(),
        },
    )
    .await
    {
        Ok(user_index_canister::c2c_lookup_user::Response::Success(r)) => Ok((caller, r.principal)),
        Ok(user_index_canister::c2c_lookup_user::Response::UserNotFound) => Err(UserNotFound),
        Ok(user_index_canister::c2c_lookup_user::Response::Error(error)) => Err(Error(error)),
        Err(error) => Err(InternalError(format!("{error:?}"))),
    }
}

struct PrepareResult {
    pub local_group_index_canister: CanisterId,
}

fn prepare(name: &str, is_public: bool, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    let now = state.env.now();

    if is_public && !state.data.public_group_and_community_names.reserve_name(name, now) {
        return Err(NameTaken);
    }

    if let Some(local_group_index_canister) = state.data.local_index_map.index_for_new_community() {
        Ok(PrepareResult {
            local_group_index_canister,
        })
    } else {
        Err(InternalError("No available LocalGroupIndex found".to_string()))
    }
}

#[allow(clippy::too_many_arguments)]
fn commit(
    args: local_group_index_canister::c2c_create_community::Args,
    community_id: CommunityId,
    local_group_index_canister: CanisterId,
    state: &mut RuntimeState,
) {
    let now = state.env.now();
    if args.is_public {
        state
            .data
            .public_group_and_community_names
            .insert(&args.name, community_id.into());
        state.data.public_communities.add(
            community_id,
            args.name,
            args.description,
            Document::id(&args.avatar),
            Document::id(&args.banner),
            args.gate_config,
            args.primary_language,
            args.default_channels.len() as u32,
            now,
        );
    } else {
        state
            .data
            .private_communities
            .add(PrivateCommunityInfo::new(community_id, now));
    }
    state
        .data
        .local_index_map
        .add_community(local_group_index_canister, community_id);
}
