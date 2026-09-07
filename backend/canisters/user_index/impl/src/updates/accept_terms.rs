use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_index_canister::accept_terms::*;

// Bump alongside the frontend CURRENT_TERMS_VERSION whenever the terms change. Acceptance is
// clamped to this so a client cannot pre-accept future terms (eg. u32::MAX) and suppress
// every future notice.
pub const CURRENT_TERMS_VERSION: u32 = 2;

// Records the user's acceptance of the platform terms (an affirmative click on the
// terms-updated notice). The version and timestamp are kept as evidence of acceptance.
#[update(msgpack = true)]
#[trace]
fn accept_terms(args: Args) -> Response {
    mutate_state(|state| accept_terms_impl(args, state))
}

fn accept_terms_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    if state
        .data
        .users
        .accept_terms(&caller, args.version.min(CURRENT_TERMS_VERSION), now)
    {
        Response::Success
    } else {
        Response::Error(OCErrorCode::InitiatorNotFound.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // The frontend holds its own copy of this constant (it labels the terms text and acts
    // as a fallback when the server value is absent); the two must move in lockstep or the
    // terms-updated notice either never fires (backend behind) or loops forever (frontend
    // behind). Parses the frontend source so a half-bump fails CI.
    #[test]
    fn terms_version_matches_frontend() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../../frontend/openchat-shared/src/constants.ts"
        );
        let src = std::fs::read_to_string(path).unwrap();
        let line = src
            .lines()
            .find(|l| l.contains("CURRENT_TERMS_VERSION"))
            .expect("CURRENT_TERMS_VERSION not found in frontend constants.ts");
        let frontend_version: u32 = line
            .split('=')
            .nth(1)
            .unwrap()
            .trim()
            .trim_end_matches(';')
            .parse()
            .expect("failed to parse frontend CURRENT_TERMS_VERSION");
        assert_eq!(frontend_version, CURRENT_TERMS_VERSION);
    }
}
