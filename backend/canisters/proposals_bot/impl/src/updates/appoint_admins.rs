use crate::guards::caller_is_governance_principal;
use crate::read_state;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use proposals_bot_canister::appoint_admins::{Response::*, *};
use types::{CanisterId, GroupRole, UserId};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn appoint_admins(args: Args) -> Response {
    if let Some(group_id) = read_state(|state| state.data.nervous_systems.get_chat_id(&args.governance_canister_id)) {
        for user_id in args.users {
            ic_cdk::spawn(appoint_admin(group_id.into(), user_id));
        }
        Success
    } else {
        NotFound
    }
}

async fn appoint_admin(group_id: CanisterId, user_id: UserId) {
    let args = group_canister::change_role::Args {
        user_id,
        new_role: GroupRole::Admin,
        correlation_id: 0,
    };

    let _ = group_canister_c2c_client::change_role(group_id, &args).await;
}
