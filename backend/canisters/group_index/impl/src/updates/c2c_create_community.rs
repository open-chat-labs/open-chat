use crate::model::private_communities::PrivateCommunityInfo;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_create_community::{Response::*, *};
use types::{CanisterId, CommunityId, Document, UserId};

#[update_msgpack]
#[trace]
async fn c2c_create_community(args: Args) -> Response {
    let avatar_id = Document::id(&args.avatar);
    let banner_id = Document::id(&args.banner);

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
        gate: args.gate,
        default_channels: args.default_channels,
    };

    match local_group_index_canister_c2c_client::c2c_create_community(local_group_index_canister, &c2c_create_community_args)
        .await
    {
        Ok(local_group_index_canister::c2c_create_community::Response::Success(result)) => {
            mutate_state(|state| {
                commit(
                    args.is_public,
                    result.community_id,
                    args.name,
                    args.description,
                    avatar_id,
                    banner_id,
                    local_group_index_canister,
                    state,
                )
            });
            Success(SuccessResult {
                community_id: result.community_id,
            })
        }
        Ok(local_group_index_canister::c2c_create_community::Response::CyclesBalanceTooLow) => CyclesBalanceTooLow,
        Ok(local_group_index_canister::c2c_create_community::Response::InternalError(_)) => InternalError,
        Err(_) => {
            mutate_state(|state| rollback(args.is_public, &args.name, state));
            InternalError
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
        Err(_) => Err(InternalError),
    }
}

struct PrepareResult {
    pub local_group_index_canister: CanisterId,
}

fn prepare(name: &str, is_public: bool, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    let now = state.env.now();

    if is_public && !state.data.public_communities.reserve_name(name, now) {
        return Err(NameTaken);
    }

    if let Some(local_group_index_canister) = state.data.local_index_map.index_for_new_canister() {
        Ok(PrepareResult {
            local_group_index_canister,
        })
    } else {
        Err(InternalError)
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
    local_group_index_canister: CanisterId,
    state: &mut RuntimeState,
) {
    let now = state.env.now();
    if is_public {
        state
            .data
            .public_communities
            .handle_community_created(community_id, name, description, avatar_id, banner_id, now);
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

fn rollback(is_public: bool, name: &str, state: &mut RuntimeState) {
    if is_public {
        state.data.public_communities.handle_community_creation_failed(name);
    }
}
