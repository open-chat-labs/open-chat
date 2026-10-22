use crate::guards::caller_is_user_index_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::UserIdentity;
use identity_canister::UserIndexEvent;
use identity_canister::c2c_user_index::*;
use tracing::error;
use types::CanisterId;

#[update(guard = "caller_is_user_index_canister", msgpack = true)]
#[trace]
fn c2c_user_index(args: Args) -> Response {
    mutate_state(|state| c2c_user_index_impl(args, state))
}

fn c2c_user_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(state.data.user_index_canister_id, event.created_at, event.idempotency_id)
        {
            match event.value {
                UserIndexEvent::SetUserIdentity(user) => set_user_identity(user, state),
            }
        }
    }
    Response::Success
}

fn set_user_identity(user: UserIdentity, state: &mut RuntimeState) {
    if state.data.user_principals.set_user_id(user.principal, user.user_id)
        && let Some(email) = user.email
        && let Some(index) = state.data.user_principals.user_principal_index(&user.principal)
    {
        ic_cdk::futures::spawn_migratory(link_email_auth_principal_to_user_identity(
            state.data.sign_in_with_email_canister_id,
            email,
            index,
        ));
    }
}

async fn link_email_auth_principal_to_user_identity(
    sign_in_with_email_canister_id: CanisterId,
    email: String,
    user_principal_index: u32,
) {
    match sign_in_with_email_canister_c2c_client::get_principal(
        sign_in_with_email_canister_id,
        &sign_in_with_email_canister::get_principal::Args { email: email.clone() },
    )
    .await
    {
        Ok(auth_principal) => {
            mutate_state(|state| {
                if !state.data.user_principals.link_auth_principal_with_existing_user(
                    auth_principal,
                    sign_in_with_email_canister_id,
                    None,
                    false,
                    user_principal_index,
                    0,
                ) {
                    error!("Principal for email {email} is already linked to another user");
                }
            });
        }
        Err(error) => {
            error!(?error, "Failed to get principal for email {}", email);
        }
    }
}
