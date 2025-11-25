use crate::guards::caller_is_user_index_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::c2c_set_user_identities::*;
use tracing::error;
use types::CanisterId;

#[update(guard = "caller_is_user_index_canister", msgpack = true)]
#[trace]
fn c2c_set_user_identities(args: Args) -> Response {
    // This function runs in O(number of users registered x batch size),
    // so we need to ensure each batch is fairly small
    assert!(args.users.len() <= 100);

    mutate_state(|state| c2c_set_user_identities_impl(args, state))
}

fn c2c_set_user_identities_impl(args: Args, state: &mut RuntimeState) -> Response {
    let sign_in_with_email_canister_id = state.data.sign_in_with_email_canister_id;

    for user in args.users {
        let Some(index) = state.data.user_principals.set_user_id(user.principal, user.user_id) else {
            continue;
        };

        if let Some(email) = user.email {
            ic_cdk::futures::spawn(link_email_auth_principal_to_user_identity(
                sign_in_with_email_canister_id,
                email,
                index,
            ));
        };
    }

    Response::Success
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
                    error!("Principal for email {} is already linked to another user", email);
                }
            });
        }
        Err(error) => {
            error!(?error, "Failed to get principal for email {}", email);
        }
    }
}
