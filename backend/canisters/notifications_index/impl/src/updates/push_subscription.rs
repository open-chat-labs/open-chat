use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use notifications_index_canister::push_subscription::{Response::*, *};
use types::{CanisterId, UserId};
use user_index_canister::c2c_lookup_user;

#[update]
#[trace]
async fn push_subscription(args: Args) -> Response {
    let user_id = match read_state(lookup_user_locally) {
        LookupResult::Found(user_id) => user_id,
        LookupResult::NotFound((user_principal, user_index_canister_id)) => {
            let c2c_lookup_user_args = c2c_lookup_user::Args {
                user_id_or_principal: user_principal,
            };
            match user_index_canister_c2c_client::c2c_lookup_user(user_index_canister_id, &c2c_lookup_user_args).await {
                Ok(c2c_lookup_user::Response::Success(user)) => {
                    mutate_state(|state| add_user_locally(user_principal, user.user_id, state));
                    user.user_id
                }
                Ok(c2c_lookup_user::Response::UserNotFound) => panic!("User not found"),
                Err(error) => return InternalError(format!("Failed to call 'user_index::c2c_lookup_user': {error:?}")),
            }
        }
    };

    mutate_state(|state| state.add_subscription(user_id, args.subscription));
    Success
}

fn lookup_user_locally(runtime_state: &RuntimeState) -> LookupResult {
    let caller = runtime_state.env.caller();
    if let Some(user_id) = runtime_state.data.principal_to_user_id.get(&caller).copied() {
        LookupResult::Found(user_id)
    } else {
        LookupResult::NotFound((caller, runtime_state.data.user_index_canister_id))
    }
}

enum LookupResult {
    Found(UserId),
    NotFound((Principal, CanisterId)),
}

fn add_user_locally(principal: Principal, user_id: UserId, runtime_state: &mut RuntimeState) {
    runtime_state.data.principal_to_user_id.insert(principal, user_id);
}
