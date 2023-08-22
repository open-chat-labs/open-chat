use crate::model::private_communities::PrivateCommunityInfo;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_create_community::{Response::*, *};
use types::{AccessGate, CanisterId, CommunityId, Document, UserId};

#[update_msgpack]
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
        gate: args.gate.clone(),
        default_channels: args.default_channels,
        source_group: None,
        primary_language: args.primary_language.clone(),
    };

    match create_community_impl(c2c_create_community_args, local_group_index_canister).await {
        Ok(community_id) => Success(SuccessResult { community_id }),
        Err(error) => InternalError(error),
    }
}

pub(crate) async fn create_community_impl(
    args: local_group_index_canister::c2c_create_community::Args,
    local_group_index_canister: CanisterId,
) -> Result<CommunityId, String> {
    match local_group_index_canister_c2c_client::c2c_create_community(local_group_index_canister, &args).await {
        Ok(local_group_index_canister::c2c_create_community::Response::Success(result)) => {
            mutate_state(|state| {
                let avatar_id = Document::id(&args.avatar);
                let banner_id = Document::id(&args.banner);

                commit(
                    args.is_public,
                    result.community_id,
                    args.name,
                    args.description,
                    avatar_id,
                    banner_id,
                    args.gate,
                    args.primary_language,
                    local_group_index_canister,
                    args.default_channels.len() as u32,
                    state,
                )
            });
            Ok(result.community_id)
        }
        Ok(local_group_index_canister::c2c_create_community::Response::InternalError(error)) => Err(error),
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

    if let Some(local_group_index_canister) = state.data.local_index_map.index_for_new_canister() {
        Ok(PrepareResult {
            local_group_index_canister,
        })
    } else {
        Err(InternalError("No available LocalGroupIndex found".to_string()))
    }
}

#[allow(clippy::too_many_arguments)]
fn commit(
    is_public: bool,
    community_id: CommunityId,
    name: String,
    description: String,
    avatar_id: Option<u128>,
    banner_id: Option<u128>,
    gate: Option<AccessGate>,
    primary_language: String,
    local_group_index_canister: CanisterId,
    channel_count: u32,
    state: &mut RuntimeState,
) {
    let now = state.env.now();
    if is_public {
        state.data.public_group_and_community_names.insert(&name, community_id.into());
        state.data.public_communities.add(
            community_id,
            name,
            description,
            avatar_id,
            banner_id,
            gate,
            primary_language,
            channel_count,
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
