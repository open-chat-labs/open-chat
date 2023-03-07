use crate::model::public_groups::GroupCreatedArgs;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_create_group::{Response::*, *};
use types::{Avatar, CanisterId, ChatId, GroupSubtype, UserId};

#[update_msgpack]
#[trace]
async fn c2c_create_group(args: Args) -> Response {
    let avatar_id = Avatar::id(&args.avatar);

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

    let c2c_create_group_args = local_group_index_canister::c2c_create_group::Args {
        created_by_user_id: user_id,
        created_by_user_principal: principal,
        is_public: args.is_public,
        name: args.name.clone(),
        description: args.description.clone(),
        rules: args.rules,
        subtype: args.subtype.clone(),
        avatar: args.avatar,
        history_visible_to_new_joiners: args.history_visible_to_new_joiners,
        permissions: args.permissions,
        events_ttl: args.events_ttl,
    };

    match local_group_index_canister_c2c_client::c2c_create_group(local_group_index_canister, &c2c_create_group_args).await {
        Ok(local_group_index_canister::c2c_create_group::Response::Success(result)) => {
            mutate_state(|state| {
                commit(
                    CommitArgs {
                        is_public: args.is_public,
                        chat_id: result.chat_id,
                        name: args.name,
                        description: args.description,
                        subtype: args.subtype,
                        avatar_id,
                        local_group_index_canister,
                    },
                    state,
                )
            });
            Success(SuccessResult { chat_id: result.chat_id })
        }
        Ok(local_group_index_canister::c2c_create_group::Response::CyclesBalanceTooLow) => CyclesBalanceTooLow,
        Ok(local_group_index_canister::c2c_create_group::Response::InternalError(_)) => InternalError,
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

fn prepare(name: &str, is_public: bool, runtime_state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    let now = runtime_state.env.now();

    if is_public && !runtime_state.data.public_groups.reserve_name(name, now) {
        return Err(NameTaken);
    }

    if let Some(local_group_index_canister) = runtime_state.data.local_index_map.index_for_new_group() {
        Ok(PrepareResult {
            local_group_index_canister,
        })
    } else {
        Err(InternalError)
    }
}

struct CommitArgs {
    is_public: bool,
    chat_id: ChatId,
    name: String,
    description: String,
    subtype: Option<GroupSubtype>,
    avatar_id: Option<u128>,
    local_group_index_canister: CanisterId,
}

fn commit(args: CommitArgs, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    if args.is_public {
        runtime_state.data.public_groups.handle_group_created(GroupCreatedArgs {
            chat_id: args.chat_id,
            name: args.name,
            description: args.description,
            subtype: args.subtype,
            avatar_id: args.avatar_id,
            now,
        });
    } else {
        runtime_state.data.private_groups.handle_group_created(args.chat_id, now);
    }
    runtime_state
        .data
        .local_index_map
        .add_group(args.local_group_index_canister, args.chat_id);
}

fn rollback(is_public: bool, name: &str, runtime_state: &mut RuntimeState) {
    if is_public {
        runtime_state.data.public_groups.handle_group_creation_failed(name);
    }
}
