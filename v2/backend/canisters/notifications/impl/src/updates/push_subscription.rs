use crate::{RuntimeState, RUNTIME_STATE};
use candid::Principal;
use canister_api_macros::trace;
use ic_cdk_macros::update;
use notifications_canister::push_subscription::{Response::*, *};
use types::{CanisterId, SubscriptionInfo, UserId};
use user_index_canister::c2c_lookup_user;

#[update]
#[trace]
async fn push_subscription(args: Args) -> Response {
    let user_id = match RUNTIME_STATE.with(|state| lookup_user_locally(state.borrow().as_ref().unwrap())) {
        LookupResult::Found(user_id) => user_id,
        LookupResult::NotFound((user_principal, user_index_canister_id)) => {
            let c2c_lookup_user_args = c2c_lookup_user::Args { user_principal };
            match user_index_canister_c2c_client::c2c_lookup_user(user_index_canister_id, &c2c_lookup_user_args).await {
                Ok(user_index_canister::c2c_lookup_user::Response::Success(user_id)) => {
                    RUNTIME_STATE.with(|state| add_user_locally(user_principal, user_id, state.borrow_mut().as_mut().unwrap()));
                    user_id
                }
                Ok(user_index_canister::c2c_lookup_user::Response::UserNotFound) => return UserNotFound,
                Err(error) => return InternalError(format!("Failed to call 'user_idex::c2c_lookup_user': {:?}", error)),
            }
        }
    };

    RUNTIME_STATE.with(|state| add_subscription(user_id, args.subscription, state.borrow_mut().as_mut().unwrap()));
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

fn add_subscription(user_id: UserId, subscription: SubscriptionInfo, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    runtime_state.data.subscriptions.push(user_id, subscription, now);
}
