use crate::{check_public_key, mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::update;
use identity_canister::create_webauthn_identity::{Response::*, *};
use types::CanisterId;

// zzvwb-passk-eyaut-hv6r3-cai
const ORIGINATING_CANISTER_ID: CanisterId = CanisterId::from_slice(&[18, 146, 137, 128, 82, 103, 175, 163, 177, 1]);

#[update]
#[trace]
fn create_webauthn_identity(args: Args) -> Response {
    mutate_state(|state| create_webauthn_identity_impl(args, state))
}

fn create_webauthn_identity_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    if state.data.user_principals.get_by_auth_principal(&caller).is_some() {
        return AlreadyRegistered;
    }

    if let Err(error) = check_public_key(caller, &args.public_key) {
        return PublicKeyInvalid(error);
    }

    let now = state.env.now();
    if !state.data.challenges.check(&args.challenge_attempt, now) {
        return ChallengeFailed;
    }

    let auth_seed = state.data.calculate_webauthn_seed(&args.credential_id);
    if !state
        .data
        .webauthn_keys
        .add(args.credential_id.into(), args.public_key.into(), now)
    {
        return AlreadyRegistered;
    }

    let seed = state.push_new_user(caller, ORIGINATING_CANISTER_ID, false);
    let auth_session = state.prepare_delegation(auth_seed, args.auth_session_key, args.max_time_to_live);
    let user_session = state.prepare_delegation(seed, args.session_key, args.max_time_to_live);

    Success(SuccessResult {
        auth_session,
        user_session,
    })
}
