use crate::updates::prepare_delegation::prepare_delegation_inner;
use crate::{check_public_key, extract_originating_canister, mutate_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use constants::DAY_IN_MS;
use ic_cdk::update;
use identity_canister::create_identity::{Response::*, *};
use identity_canister::WEBAUTHN_ORIGINATING_CANISTER;

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

    if let Err(error) = check_public_key(caller, &args.public_key) {
        return PublicKeyInvalid(error);
    }

    let (auth_principal, originating_canister) = if let Some(webauthn_key) = args.webauthn_key.as_ref() {
        state.assert_key_not_generated_by_this_canister(&args.public_key);

        (
            Principal::self_authenticating(&webauthn_key.public_key),
            WEBAUTHN_ORIGINATING_CANISTER,
        )
    } else {
        match extract_originating_canister(&args.public_key) {
            Ok(canister_id) => (caller, canister_id),
            Err(error) => return PublicKeyInvalid(error),
        }
    };

    if !state.data.originating_canisters.contains(&originating_canister) {
        return OriginatingCanisterInvalid(originating_canister);
    }

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

    let webauthn_credential_id = if let Some(webauthn_key) = args.webauthn_key {
        let now = state.env.now();
        let credential_id = webauthn_key.credential_id.clone();
        state.data.webauthn_keys.add(webauthn_key, now);

        state
            .data
            .user_principals
            .add_temp_key(caller, auth_principal, now, now + (30 * DAY_IN_MS));

        Some(credential_id.into())
    } else {
        None
    };

    let seed = state.push_new_user(
        auth_principal,
        originating_canister,
        webauthn_credential_id,
        args.is_ii_principal.unwrap_or_default(),
    );

    let result = prepare_delegation_inner(seed, args.session_key, args.max_time_to_live, state);

    Success(SuccessResult {
        user_key: result.user_key,
        expiration: result.expiration,
    })
}
