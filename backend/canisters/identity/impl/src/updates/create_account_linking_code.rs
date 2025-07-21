use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::create_account_linking_code::{Response::*, *};
use types::AccountLinkingCode;

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

    if let Some(user_id) = caller_user_id {
        // Clean up expired codes - keeps the memory footprint smaller in
        // exchange for a bit of extra CPU time.
        state
            .data
            .account_linking_codes
            .retain(|_, linking_code| linking_code.is_valid(now));

        // Attempt to generate linking code, up to max number of attempts
        let mut current_attempt = 0;
        while current_attempt < MAX_CODE_GEN_ATTEMPTS {
            let Ok(linking_code) = AccountLinkingCode::new(user_id, rng, now) else {
                continue;
            };

            // Check if the code already exists in the state, if it does, we
            // try again; if not, we insert it and return success.
            if !state.data.account_linking_codes.contains_key(&linking_code.value) {
                state
                    .data
                    .account_linking_codes
                    .insert(linking_code.value.clone(), linking_code.clone());

                return Success(linking_code);
            }

            current_attempt += 1;
        }

        FailedToGenerateCode
    } else {
        UserNotFound
    }
}
