use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::create_account_linking_code::{Response::*, *};

const MAX_CODE_GEN_ATTEMPTS: usize = 20;

#[update(msgpack = true, candid = true)]
#[trace]
fn create_account_linking_code(_args: Args) -> Response {
    mutate_state(create_account_linking_code_impl)
}

fn create_account_linking_code_impl(state: &mut RuntimeState) -> Response {
    let Some(user_id) = state.get_user_id_by_caller() else {
        return UserNotFound;
    };

    let now = state.env.now();
    let rng = state.env.rng();

    // Clean up expired codes, keeps the memory footprint smaller in
    // exchange for a bit of extra CPU time.
    state.data.account_linking_codes.cleanup(now);

    // Check if we have a valid code available, and return it if there is one!
    let existing_linking_code = state.data.account_linking_codes.get_by_user_id(&user_id);
    if let Some(code) = existing_linking_code {
        if code.is_valid(now) {
            return Success(code);
        }
    }

    // Attempt to generate linking code, up to max number of attempts
    for _ in 0..MAX_CODE_GEN_ATTEMPTS {
        let new_linking_code = state.data.account_linking_codes.get_new_linking_code(user_id, rng, now);

        if let Ok(code) = new_linking_code {
            return Success(code);
        }
    }

    FailedToGenerateCode
}
