use crate::guards::caller_is_governance_principal;
use crate::read_state;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use proposals_bot_canister::appoint_admins::{Response::*, *};
use types::{ChannelId, ChatId, CommunityId, GroupRole, MultiUserChat, UserId};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn appoint_admins(args: Args) -> Response {
    if let Some(chat_id) = read_state(|state| state.data.nervous_systems.get_chat_id(&args.governance_canister_id)) {
        for user_id in args.users {
            match chat_id {
                MultiUserChat::Group(group_id) => ic_cdk::spawn(appoint_group_admin(group_id, user_id)),
                MultiUserChat::Channel(community_id, channel_id) => {
                    ic_cdk::spawn(appoint_channel_admin(community_id, channel_id, user_id))
                }
            }
        }
        Success
    } else {
        NotFound
    }
}

async fn appoint_group_admin(group_id: ChatId, user_id: UserId) {
    let args = group_canister::change_role::Args {
        user_id,
        new_role: GroupRole::Admin,
        correlation_id: 0,
    };

    let _ = group_canister_c2c_client::change_role(group_id.into(), &args).await;
}

async fn appoint_channel_admin(community_id: CommunityId, channel_id: ChannelId, user_id: UserId) {
    let args = community_canister::change_channel_role::Args {
        channel_id,
        user_id,
        new_role: GroupRole::Admin,
    };

    let _ = community_canister_c2c_client::change_channel_role(community_id.into(), &args).await;
}
