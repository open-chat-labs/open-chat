use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ic_cdk::call::RejectCode;
use ic_cdk::management_canister::{VetKDCurve, VetKDDeriveKeyArgs, VetKDKeyId};
use identity_canister::get_encryption_key::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};
use types::{C2CError, CanisterId, OCResult, UserId};

#[update(msgpack = true)]
#[trace]
async fn get_encryption_key(args: Args) -> Response {
    let caller_user_id = match mutate_state(prepare) {
        Ok(id) => id,
        Err(error) => return Error(error),
    };

    let ContextAndInput { context, input } = calculate_context_and_input(caller_user_id, args.key_type);

    let derive_key_result = ic_cdk::management_canister::vetkd_derive_key(&VetKDDeriveKeyArgs {
        key_id: VetKDKeyId {
            curve: VetKDCurve::Bls12_381_G2,
            name: "test_key_1".to_string(),
        },
        input,
        context,
        transport_public_key: args.transport_public_key,
    })
    .await;

    mutate_state(|state| match derive_key_result {
        Ok(r) => {
            mark_complete(&caller_user_id, args.key_type, None, state);
            Success(SuccessResult {
                encrypted_key: r.encrypted_key,
            })
        }
        Err(e) => {
            let error: OCError = C2CError::new(
                CanisterId::management_canister(),
                "vetkd_derive_key",
                RejectCode::SysUnknown,
                e.to_string(),
            )
            .into();
            mark_complete(&caller_user_id, args.key_type, Some(error.clone()), state);
            Error(error)
        }
    })
}

fn prepare(state: &mut RuntimeState) -> OCResult<UserId> {
    let caller = state.caller_auth_principal();
    let user_id = state
        .data
        .user_principals
        .get_by_auth_principal(&caller)
        .and_then(|p| p.user_id)
        .ok_or(OCErrorCode::InitiatorNotFound)?;

    state
        .data
        .encryption_key_requests
        .try_start_for_user(user_id, state.env.now())
        .map_err(|ms| OCErrorCode::Throttled.with_message(ms))?;

    Ok(user_id)
}

fn mark_complete(caller_user_id: &UserId, key_type: KeyType, error: Option<OCError>, state: &mut RuntimeState) {
    state
        .data
        .encryption_key_requests
        .mark_complete(caller_user_id, key_type, error, state.env.now());
}

#[derive(Default)]
struct ContextAndInput {
    context: Vec<u8>,
    input: Vec<u8>,
}

fn calculate_context_and_input(caller_user_id: UserId, key_type: KeyType) -> ContextAndInput {
    let context;
    let input;
    let caller_user_id_bytes = caller_user_id.as_slice();
    match key_type {
        KeyType::User => {
            context = b"oc-user".to_vec();
            input = caller_user_id_bytes.to_vec();
        }
    }
    ContextAndInput { context, input }
}
