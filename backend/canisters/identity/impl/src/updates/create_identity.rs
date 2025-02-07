use crate::updates::prepare_delegation::prepare_delegation_inner;
use crate::{extract_originating_canister, mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::update;
use identity_canister::create_identity::{Response::*, *};

#[update]
#[trace]
fn create_identity(args: Args) -> Response {
    mutate_state(|state| create_identity_impl(args, state))
}

fn create_identity_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    if state.data.user_principals.get_by_auth_principal(&caller).is_some() {
        return AlreadyRegistered;
    }

    let originating_canister = match extract_originating_canister(caller, &args.public_key) {
        Ok(c) => c,
        Err(error) => return PublicKeyInvalid(error),
    };

    if !state.data.originating_canisters.contains(&originating_canister) {
        return OriginatingCanisterInvalid(originating_canister);
    }

    if state.data.requires_captcha(&originating_canister) {
        let Some(attempt) = args.challenge_attempt else {
            return ChallengeRequired;
        };

        if !state.data.challenges.check(&attempt, state.env.now()) {
            return ChallengeFailed;
        }
    }

    let seed = state.push_new_user(caller, originating_canister, args.is_ii_principal.unwrap_or_default());

    Success(prepare_delegation_inner(seed, args.session_key, args.max_time_to_live, state))
}
