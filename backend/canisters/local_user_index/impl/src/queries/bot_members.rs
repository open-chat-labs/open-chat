use crate::bots::{BotAccessContext, extract_access_context_from_community_or_group_context};
use crate::mutate_state;
use canister_api_macros::{query, update};
use canister_tracing_macros::trace;
use local_user_index_canister::bot_members::*;
use oc_error_codes::OCErrorCode;
use std::collections::HashSet;
use types::{BotActionScope, ChannelId, Chat, MemberType, MembersResponse, MembersResult, OCResult};

#[update(candid = true, msgpack = true)]
#[trace]
async fn bot_members_c2c(args: Args) -> MembersResponse {
    bot_members(args).await
}

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn bot_members(args: Args) -> MembersResponse {
    let context = match mutate_state(|state| {
        extract_access_context_from_community_or_group_context(args.community_or_group_context, state)
    }) {
        Ok(context) => context,
        Err(_) => return Response::Error(OCErrorCode::BotNotAuthenticated.into()),
    };

    match call_canister(context, args.channel_id, args.member_types).await {
        Ok(result) => Response::Success(result),
        Err(error) => Response::Error(error),
    }
}

async fn call_canister(
    context: BotAccessContext,
    channel_id: Option<ChannelId>,
    member_types: HashSet<MemberType>,
) -> OCResult<MembersResult> {
    let response = match context.scope {
        BotActionScope::Chat(details) => match details.chat {
            Chat::Channel(community_id, _) => {
                community_canister_c2c_client::c2c_bot_members(
                    community_id.into(),
                    &community_canister::c2c_bot_members::Args {
                        bot_id: context.bot_id,
                        initiator: context.initiator,
                        channel_id,
                        member_types,
                    },
                )
                .await
            }
            Chat::Group(chat_id) => {
                group_canister_c2c_client::c2c_bot_members(
                    chat_id.into(),
                    &group_canister::c2c_bot_members::Args {
                        bot_id: context.bot_id,
                        initiator: context.initiator,
                        member_types,
                    },
                )
                .await
            }
            Chat::Direct(_) => {
                return Err(OCErrorCode::InvalidBotActionScope.with_message("Direct chats not supported"));
            }
        },
        BotActionScope::Community(details) => {
            community_canister_c2c_client::c2c_bot_members(
                details.community_id.into(),
                &community_canister::c2c_bot_members::Args {
                    bot_id: context.bot_id,
                    initiator: context.initiator,
                    channel_id,
                    member_types,
                },
            )
            .await
        }
    };

    match response {
        Ok(MembersResponse::Success(success)) => Ok(success),
        Ok(MembersResponse::Error(error)) => Err(error),
        Err(e) => Err(e.into()),
    }
}
