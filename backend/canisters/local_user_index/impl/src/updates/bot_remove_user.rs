use crate::updates::c2c_notify_low_balance::top_up_and_retry_if_out_of_cycles;
use crate::{
    bots::{BotAccessContext, extract_access_context_from_community_or_group_context},
    mutate_state,
};
use canister_api_macros::update;
use local_user_index_canister::bot_remove_user::*;
use oc_error_codes::OCErrorCode;
use types::{BotActionScope, CanisterId, ChannelId, Chat, UserId};

#[update(candid = true, json = true, msgpack = true)]
async fn bot_remove_user(args: Args) -> Response {
    let context = match mutate_state(|state| {
        extract_access_context_from_community_or_group_context(args.community_or_group_context, state)
    }) {
        Ok(context) => context,
        Err(_) => return OCErrorCode::BotNotAuthenticated.into(),
    };

    call_chat_canister(context, args.channel_id, args.user_id, args.block).await
}

async fn call_chat_canister(
    context: BotAccessContext,
    channel_id: Option<ChannelId>,
    user_id: UserId,
    block: bool,
) -> Response {
    match context.scope {
        BotActionScope::Chat(details) => match details.chat {
            Chat::Channel(community_id, _) => {
                let canister_id = CanisterId::from(community_id);
                let c2c_args = community_canister::c2c_bot_remove_user::Args {
                    bot_id: context.bot_id,
                    initiator: context.initiator,
                    channel_id,
                    user_id,
                    block,
                };
                top_up_and_retry_if_out_of_cycles(canister_id, || {
                    community_canister_c2c_client::c2c_bot_remove_user(canister_id, &c2c_args)
                })
                .await
                .into()
            }
            Chat::Group(chat_id) => {
                let canister_id = CanisterId::from(chat_id);
                let c2c_args = group_canister::c2c_bot_remove_user::Args {
                    bot_id: context.bot_id,
                    initiator: context.initiator,
                    user_id,
                    block,
                };
                top_up_and_retry_if_out_of_cycles(canister_id, || {
                    group_canister_c2c_client::c2c_bot_remove_user(canister_id, &c2c_args)
                })
                .await
                .into()
            }
            Chat::Direct(_) => OCErrorCode::InvalidBotActionScope
                .with_message("Direct chats not supported")
                .into(),
        },
        BotActionScope::Community(details) => {
            let canister_id = CanisterId::from(details.community_id);
            let c2c_args = community_canister::c2c_bot_remove_user::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                channel_id,
                user_id,
                block,
            };
            top_up_and_retry_if_out_of_cycles(canister_id, || {
                community_canister_c2c_client::c2c_bot_remove_user(canister_id, &c2c_args)
            })
            .await
            .into()
        }
    }
}
