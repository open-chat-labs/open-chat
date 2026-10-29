use crate::guards::caller_is_mini_app_service;
use crate::updates::c2c_notify_low_balance::top_up_and_retry_if_out_of_cycles;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::update_mini_app::*;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, Chat};

// The MiniApp service writing a card's status to the group or channel it's in. Only the service writes
// it, so a bot can't list anyone who didn't join.
#[update(guard = "caller_is_mini_app_service", candid = true, msgpack = true)]
#[trace]
async fn update_mini_app(args: Args) -> Response {
    match args.chat {
        Chat::Direct(_) => OCErrorCode::InvalidRequest
            .with_message("Direct chats have no MiniApp cards")
            .into(),
        Chat::Channel(community_id, channel_id) => {
            let canister_id = CanisterId::from(community_id);
            let c2c_args = community_canister::c2c_update_mini_app::Args {
                channel_id,
                thread: args.thread,
                message_id: args.message_id,
                update: args.update,
            };
            top_up_and_retry_if_out_of_cycles(canister_id, || {
                community_canister_c2c_client::c2c_update_mini_app(canister_id, &c2c_args)
            })
            .await
            .into()
        }
        Chat::Group(chat_id) => {
            let canister_id = CanisterId::from(chat_id);
            let c2c_args = group_canister::c2c_update_mini_app::Args {
                thread: args.thread,
                message_id: args.message_id,
                update: args.update,
            };
            top_up_and_retry_if_out_of_cycles(canister_id, || {
                group_canister_c2c_client::c2c_update_mini_app(canister_id, &c2c_args)
            })
            .await
            .into()
        }
    }
}
