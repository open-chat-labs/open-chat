use crate::updates::set_username::{validate_username, UsernameValidationResult};
use crate::{mutate_state, RuntimeState, ONE_MB, USER_LIMIT};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::{Event, UserRegistered};
use storage_index_canister::add_or_update_users::UserConfig;
use types::{CanisterId, UserId, Version};
use user_index_canister::register_user::{Response::*, *};
use x509_parser::prelude::FromDer;
use x509_parser::x509::SubjectPublicKeyInfo;

#[update]
#[trace]
async fn register_user(args: Args) -> Response {
    // Check the principal is derived from Internet Identity
    // Check the username is valid and doesn't already exist then reserve it
    let PrepareOk {
        local_user_index_canister,
        user_wasm_version,
        caller,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let c2c_create_user_args = local_user_index_canister::c2c_create_user::Args {
        principal: caller,
        username: args.username.clone(),
        referred_by: args.referred_by,
    };

    let result =
        match local_user_index_canister_c2c_client::c2c_create_user(local_user_index_canister, &c2c_create_user_args).await {
            Ok(local_user_index_canister::c2c_create_user::Response::Success(user_id)) => {
                mutate_state(|state| {
                    commit(
                        caller,
                        args.username,
                        user_wasm_version,
                        user_id,
                        args.referred_by,
                        local_user_index_canister,
                        state,
                    )
                });
                return Success(user_id);
            }
            Ok(local_user_index_canister::c2c_create_user::Response::AlreadyRegistered) => AlreadyRegistered,
            Ok(local_user_index_canister::c2c_create_user::Response::CyclesBalanceTooLow) => CyclesBalanceTooLow,
            Ok(local_user_index_canister::c2c_create_user::Response::InternalError(error)) => InternalError(error),
            Err(error) => InternalError(format!("{error:?}")),
        };

    mutate_state(|state| rollback(&args.username, state));

    result
}

struct PrepareOk {
    caller: Principal,
    local_user_index_canister: CanisterId,
    user_wasm_version: Version,
}

fn prepare(args: &Args, runtime_state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    if let Err(error) = validate_public_key(caller, &args.public_key, runtime_state.data.internet_identity_canister_id) {
        return Err(PublicKeyInvalid(error));
    }

    if runtime_state.data.users.get_by_principal(&caller).is_some() {
        return Err(AlreadyRegistered);
    }

    if runtime_state.data.users.len() >= USER_LIMIT {
        return Err(UserLimitReached);
    }

    match validate_username(&args.username) {
        UsernameValidationResult::TooShort(min_length) => return Err(UsernameTooShort(min_length)),
        UsernameValidationResult::TooLong(max_length) => return Err(UsernameTooLong(max_length)),
        UsernameValidationResult::Invalid => return Err(UsernameInvalid),
        _ => {}
    };

    if !runtime_state.data.users.reserve_username(&args.username, now) {
        return Err(UsernameTaken);
    }

    if let Some(local_user_index_canister) = runtime_state.data.local_index_map.index_for_new_user() {
        let user_wasm_version = runtime_state.data.user_canister_wasm.version;
        Ok(PrepareOk {
            local_user_index_canister,
            user_wasm_version,
            caller,
        })
    } else {
        Err(InternalError("All subnets are full".to_string()))
    }
}

fn commit(
    caller: Principal,
    username: String,
    wasm_version: Version,
    user_id: UserId,
    referred_by: Option<UserId>,
    local_user_index_canister_id: CanisterId,
    runtime_state: &mut RuntimeState,
) {
    let now = runtime_state.env.now();

    runtime_state.data.users.release_username(&username);

    runtime_state
        .data
        .users
        .register(caller, user_id, wasm_version, username.clone(), now, referred_by, false);

    runtime_state
        .data
        .local_index_map
        .add_user(local_user_index_canister_id, user_id);

    runtime_state.push_event_to_all_local_user_indexes(
        Event::UserRegistered(UserRegistered {
            user_id,
            user_principal: caller,
            username,
            is_bot: false,
            referred_by,
        }),
        Some(local_user_index_canister_id),
    );

    runtime_state.data.storage_index_user_sync_queue.push(UserConfig {
        user_id: caller,
        byte_limit: 100 * ONE_MB,
    });
    crate::jobs::sync_users_to_storage_index::start_job_if_required(runtime_state);
}

fn rollback(username: &str, runtime_state: &mut RuntimeState) {
    runtime_state.data.users.release_username(username);
}

fn validate_public_key(caller: Principal, public_key: &[u8], internet_identity_canister_id: CanisterId) -> Result<(), String> {
    let key_info = SubjectPublicKeyInfo::from_der(public_key).map_err(|e| format!("{e:?}"))?.1;
    let canister_id_length = key_info.subject_public_key.data[0];

    let canister_id = CanisterId::from_slice(&key_info.subject_public_key.data[1..=(canister_id_length as usize)]);
    if canister_id != internet_identity_canister_id {
        return Err("PublicKey is not derived from the InternetIdentity canister".to_string());
    }

    let expected_caller = Principal::self_authenticating(&public_key);
    if caller == expected_caller {
        Ok(())
    } else {
        Err("PublicKey does not match caller".to_string())
    }
}
