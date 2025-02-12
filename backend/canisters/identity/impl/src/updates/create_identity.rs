use crate::updates::prepare_delegation::prepare_delegation_inner;
use crate::{mutate_state, RuntimeState, VerifyNewIdentityArgs, VerifyNewIdentityError, VerifyNewIdentitySuccess};
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
    let VerifyNewIdentitySuccess {
        caller,
        auth_principal,
        originating_canister,
        webauthn_key,
    } = match state.verify_new_identity(VerifyNewIdentityArgs {
        public_key: args.public_key,
        webauthn_key: args.webauthn_key,
    }) {
        Ok(ok) => ok,
        Err(error) => {
            return match error {
                VerifyNewIdentityError::AlreadyRegistered => AlreadyRegistered,
                VerifyNewIdentityError::PublicKeyInvalid(e) => PublicKeyInvalid(e),
                VerifyNewIdentityError::OriginatingCanisterInvalid(c) => OriginatingCanisterInvalid(c),
            }
        }
    };

    let now = state.env.now();
    if state.data.requires_captcha(&originating_canister) {
        let Some(attempt) = args.challenge_attempt else {
            return ChallengeRequired;
        };

        if !state.data.challenges.check(&attempt, now) {
            return ChallengeFailed;
        }
    }

    let webauthn_credential_id = if let Some(webauthn_key) = webauthn_key {
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
