use crate::{mutate_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use identity_canister::migrate_legacy_principal::{Response::*, *};
use types::{CanisterId, Milliseconds};

#[update]
#[trace]
async fn migrate_legacy_principal(_args: Args) -> Response {
    migrate_legacy_principal_impl(None).await.response
}

pub(crate) async fn migrate_legacy_principal_impl(principal: Option<Principal>) -> ResponseWithPause {
    let PrepareResult {
        old_principal,
        new_principal,
        user_index_canister_id,
    } = match mutate_state(|state| prepare(principal, state)) {
        Ok(ok) => ok,
        Err(response) => return ResponseWithPause { response, pause: None },
    };

    match user_index_canister_c2c_client::c2c_update_user_principal(
        user_index_canister_id,
        &user_index_canister::c2c_update_user_principal::Args {
            old_principal,
            new_principal,
        },
    )
    .await
    {
        Ok(response) => {
            mutate_state(|state| state.data.legacy_principals.remove(&old_principal));

            ResponseWithPause {
                response: Success(SuccessResult { new_principal }),
                pause: if let user_index_canister::c2c_update_user_principal::Response::SuccessPause(pause) = response {
                    Some(pause)
                } else {
                    None
                },
            }
        }
        Err(error) => ResponseWithPause {
            response: InternalError(format!("{error:?}")),
            pause: None,
        },
    }
}

pub struct ResponseWithPause {
    pub response: Response,
    pub pause: Option<Milliseconds>,
}

struct PrepareResult {
    old_principal: Principal,
    new_principal: Principal,
    user_index_canister_id: CanisterId,
}

fn prepare(old_principal: Option<Principal>, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    let old_principal = old_principal.unwrap_or_else(|| state.env.caller());

    if state.data.legacy_principals.contains(&old_principal) {
        let new_principal = if let Some(user) = state.data.user_principals.get_by_auth_principal(&old_principal) {
            user.principal
        } else {
            state.push_new_user(old_principal, state.data.internet_identity_canister_id).0
        };

        Ok(PrepareResult {
            old_principal,
            new_principal,
            user_index_canister_id: state.data.user_index_canister_id,
        })
    } else if state.data.user_principals.get_by_auth_principal(&old_principal).is_some() {
        Err(AlreadyMigrated)
    } else {
        Err(NotFound)
    }
}
