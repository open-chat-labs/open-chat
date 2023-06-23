use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use proposals_bot_canister::remove_governance_canister::{Response::*, *};
use types::MultiUserChat;

// dfx --identity openchat canister --network ic call proposals_bot remove_governance_canister '(record { governance_canister_id=principal "rrkah-fqaaa-aaaaa-aaaaq-cai"; delete_group=true })'
#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn remove_governance_canister(args: Args) -> Response {
    if let Some(chat_id) = read_state(|state| state.data.nervous_systems.get_chat_id(&args.governance_canister_id)) {
        if args.delete_group {
            match chat_id {
                MultiUserChat::Group(group_id) => {
                    let delete_group_args = group_canister::c2c_delete_group::Args {};
                    if let Err(error) = group_canister_c2c_client::c2c_delete_group(group_id.into(), &delete_group_args).await {
                        return InternalError(format!("{error:?}"));
                    }
                }
                MultiUserChat::Channel(community_id, channel_id) => {
                    let delete_channel_args = community_canister::delete_channel::Args { channel_id };
                    if let Err(error) =
                        community_canister_c2c_client::delete_channel(community_id.into(), &delete_channel_args).await
                    {
                        return InternalError(format!("{error:?}"));
                    }
                }
            }
        }

        mutate_state(|state| state.data.nervous_systems.remove(&args.governance_canister_id));
        Success
    } else {
        NotFound
    }
}
