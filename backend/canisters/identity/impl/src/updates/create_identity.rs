use crate::updates::prepare_delegation::prepare_delegation_inner;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use identity_canister::create_identity::{Response::*, *};
use types::CanisterId;
use x509_parser::prelude::{FromDer, SubjectPublicKeyInfo};

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

    if let Err(error) = validate_public_key(caller, &args.public_key, state.data.internet_identity_canister_id) {
        return PublicKeyInvalid(error);
    }

    let index = state.data.user_principals.next_index();
    let seed = state.data.calculate_seed(index);
    let principal = state.get_principal_from_seed(seed);
    state.data.user_principals.push(index, principal, caller);

    let result = prepare_delegation_inner(seed, args.session_key, args.max_time_to_live, state);

    Success(SuccessResult {
        principal,
        user_key: result.user_key,
        expiration: result.expiration,
    })
}

fn validate_public_key(caller: Principal, public_key: &[u8], internet_identity_canister_id: CanisterId) -> Result<(), String> {
    let key_info = SubjectPublicKeyInfo::from_der(public_key).map_err(|e| format!("{e:?}"))?.1;
    let canister_id_length = key_info.subject_public_key.data[0];

    let canister_id = CanisterId::from_slice(&key_info.subject_public_key.data[1..=(canister_id_length as usize)]);
    if canister_id != internet_identity_canister_id {
        return Err("PublicKey is not derived from the InternetIdentity canister".to_string());
    }

    let expected_caller = Principal::self_authenticating(public_key);
    if caller == expected_caller {
        Ok(())
    } else {
        Err("PublicKey does not match caller".to_string())
    }
}
