use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::create_account_linking_code::{Response::*, *};
use types::AccountLinkingCode;

#[update(msgpack = true, candid = true)]
#[trace]
fn create_account_linking_code(_args: Args) -> Response {
    mutate_state(create_account_linking_code_impl)
}

fn create_account_linking_code_impl(state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let caller = state.env.caller();

    if let Some(user_id) = state
        .data
        .user_principals
        .get_by_auth_principal(&caller)
        .and_then(|u| u.user_id)
    {
        // Clean up expired codes - keeps the memory footprint smaller in
        // exchange for a bit of extra CPU time.
        state.data.account_linking_codes.retain(|_, (_, alc)| alc.is_valid(now));

        let mut alc = AccountLinkingCode::new(now);

        // Verify that the generated code is unique
        while state.data.account_linking_codes.contains_key(&alc.value) {
            alc = AccountLinkingCode::new(now);
        }

        // Store the code in the state (this part is assumed, as the original code does not specify how to store it)
        state
            .data
            .account_linking_codes
            .insert(alc.value.clone(), (user_id, alc.clone()));

        Success(alc)
    } else {
        UserNotFound
    }
}
