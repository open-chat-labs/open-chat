use crate::{mutate_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use identity_canister::migrate_legacy_principal::{Response::*, *};
use types::CanisterId;

#[update]
#[trace]
async fn migrate_legacy_principal(args: Args) -> Response {
    let PrepareResult {
        caller,
        new_principal,
        user_index_canister_id,
    } = match mutate_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match user_index_canister_c2c_client::c2c_update_user_principal(
        user_index_canister_id,
        &user_index_canister::c2c_update_user_principal::Args {
            old_principal: caller,
            new_principal,
        },
    )
    .await
    {
        Ok(_) => {
            mutate_state(|state| state.data.legacy_principals.remove(&caller));
            Success(SuccessResult { new_principal })
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    caller: Principal,
    new_principal: Principal,
    user_index_canister_id: CanisterId,
}

fn prepare(args: Args, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();
    validate_public_key(caller, &args.public_key);

    if state.data.legacy_principals.contains(&caller) {
        let new_principal = if let Some(user) = state.data.user_principals.get_by_auth_principal(&caller) {
            user.principal
        } else {
            let index = state.data.user_principals.next_index();
            let principal = state.get_principal(index);
            state.data.user_principals.push(index, principal, caller);
            principal
        };

        Ok(PrepareResult {
            caller,
            new_principal,
            user_index_canister_id: state.data.user_index_canister_id,
        })
    } else if state.data.user_principals.get_by_auth_principal(&caller).is_some() {
        Err(AlreadyMigrated)
    } else {
        Err(NotFound)
    }
}

fn validate_public_key(caller: Principal, public_key: &[u8]) {
    let expected_caller = Principal::self_authenticating(public_key);
    assert_eq!(caller, expected_caller);
}
