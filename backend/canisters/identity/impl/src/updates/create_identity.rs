use crate::updates::prepare_delegation::prepare_delegation_inner;
use crate::{check_public_key, extract_originating_canister, mutate_state, RuntimeState, WEBAUTHN_ORIGINATING_CANISTER};
use candid::Principal;
use canister_tracing_macros::trace;
use constants::DAY_IN_MS;
use ic_cdk::update;
use identity_canister::create_identity::{Response::*, *};

#[update]
#[trace]
fn create_identity(args: Args) -> Response {
    mutate_state(|state| create_identity_impl(args, state))
}

fn create_identity_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    let (auth_principal, originating_canister) = if args.webauthn_key.is_some() {
        (
            Principal::self_authenticating(&args.public_key),
            WEBAUTHN_ORIGINATING_CANISTER,
        )
    } else {
        if let Err(error) = check_public_key(caller, &args.public_key) {
            return PublicKeyInvalid(error);
        }

        match extract_originating_canister(caller, &args.public_key) {
            Ok(canister_id) => {
                if !state.data.originating_canisters.contains(&canister_id) {
                    return OriginatingCanisterInvalid(canister_id);
                }
                (caller, canister_id)
            }
            Err(error) => return PublicKeyInvalid(error),
        }
    };

    if state.data.user_principals.get_by_auth_principal(&auth_principal).is_some() {
        return AlreadyRegistered;
    }

    let now = state.env.now();
    if state.data.requires_captcha(&originating_canister) {
        let Some(attempt) = args.challenge_attempt else {
            return ChallengeRequired;
        };

        if !state.data.challenges.check(&attempt, now) {
            return ChallengeFailed;
        }
    }

    let seed = state.push_new_user(auth_principal, originating_canister, args.is_ii_principal.unwrap_or_default());

    if let Some(webauthn_key) = args.webauthn_key {
        let now = state.env.now();
        state.data.webauthn_keys.add(webauthn_key, args.public_key, now);

        state
            .data
            .user_principals
            .add_temp_key(caller, auth_principal, now, now + (30 * DAY_IN_MS));
    }

    Success(prepare_delegation_inner(seed, args.session_key, args.max_time_to_live, state))
}
