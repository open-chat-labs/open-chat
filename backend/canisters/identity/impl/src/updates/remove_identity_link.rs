use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::update;
use identity_canister::remove_identity_link::{Args, Response};

#[update]
#[trace]
fn remove_identity_link(args: Args) -> Response {
    mutate_state(|state| remove_identity_link_impl(args, state))
}

fn remove_identity_link_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    if caller == args.linked_principal {
        Response::CannotUnlinkActivePrincipal
    } else {
        let user_principal = state
            .data
            .user_principals
            .get_by_auth_principal(&caller)
            .filter(|u| u.user_id.is_some());

        if let Some(user) = user_principal {
            if state
                .data
                .user_principals
                .unlink_auth_principal(args.linked_principal, user.index)
            {
                Response::Success
            } else {
                Response::IdentityLinkNotFound
            }
        } else {
            Response::UserNotFound
        }
    }
}
