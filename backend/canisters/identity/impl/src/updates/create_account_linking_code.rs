use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::MINUTE_IN_MS;
use identity_canister::account_linking_code::AccountLinkingCode;
use identity_canister::create_account_linking_code::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{CanisterId, UserId};

#[update(msgpack = true, candid = true)]
#[trace]
async fn create_account_linking_code(_args: Args) -> Response {
    match mutate_state(prepare) {
        PrepareResult::ExistingCode(linking_code) => Response::Success(linking_code),
        PrepareResult::NewCode(user_id, user_index_canister_id) => {
            match user_index_canister_c2c_client::lookup_user(user_id.into(), user_index_canister_id).await {
                Ok(Some(user_details)) => mutate_state(|state| {
                    let now = state.env.now();
                    let rng = state.env.rng();
                    Success(
                        state
                            .data
                            .account_linking_codes
                            .get_new_linking_code(user_id, user_details.username, rng, now),
                    )
                }),
                Ok(None) => Response::Error(OCErrorCode::InitiatorNotFound.into()),
                Err(c2c_error) => Response::Error(c2c_error.into()),
            }
        }
        PrepareResult::UserNotFound => Response::Error(OCErrorCode::InitiatorNotFound.into()),
    }
}

enum PrepareResult {
    ExistingCode(AccountLinkingCode),
    NewCode(UserId, CanisterId),
    UserNotFound,
}

fn prepare(state: &mut RuntimeState) -> PrepareResult {
    let Some(user_id) = state.get_user_id_by_caller() else {
        return PrepareResult::UserNotFound;
    };

    let now = state.env.now();

    // Clean up expired codes, keeps the memory footprint smaller in
    // exchange for a bit of extra CPU time.
    state.data.account_linking_codes.prune_expired(now);

    // Does the user have any valid codes?
    let existing_linking_code = state.data.account_linking_codes.get_by_user_id(&user_id);

    if let Some(code) = existing_linking_code {
        if code.is_valid(now + MINUTE_IN_MS) {
            // If the code expires in more than a minute, we return the code
            // back to the user, as we assume this gives them enough time to
            // use it.
            return PrepareResult::ExistingCode(code);
        } else {
            // Clean up the code if it expires in less than a minute, and
            // generate a new one! Users might have too little time to enter
            // the code, and if we don't do this it may cause weirdness if
            // users have two active codes.
            state.data.account_linking_codes.remove(code.value);
        }
    }

    PrepareResult::NewCode(user_id, state.data.user_index_canister_id)
}
