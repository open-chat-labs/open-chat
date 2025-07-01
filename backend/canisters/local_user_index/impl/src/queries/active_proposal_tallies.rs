use crate::{RuntimeState, read_state};
use candid::Principal;
use canister_api_macros::query;
use canister_tracing_macros::trace;
use local_user_index_canister::active_proposal_tallies::*;
use oc_error_codes::OCErrorCode;
use types::{ActiveTalliesResponse, MultiUserChat};

#[query(composite = true, msgpack = true)]
#[trace]
async fn active_proposal_tallies(args: Args) -> Response {
    let caller = read_state(|state| state.env.caller());
    let futures: Vec<_> = args.chat_ids.into_iter().map(|c| process_single_chat(caller, c)).collect();

    let responses = futures::future::join_all(futures).await;

    Response::Success(SuccessResult { responses })
}

async fn process_single_chat(caller: Principal, chat: MultiUserChat) -> ActiveTalliesResponse {
    if read_state(|state| check_chat_is_local(chat, state)) {
        let response = match chat {
            MultiUserChat::Group(group_id) => {
                group_canister_c2c_client::c2c_active_proposal_tallies(
                    group_id.into(),
                    &group_canister::c2c_active_proposal_tallies::Args {
                        args: group_canister::active_proposal_tallies::Args { invite_code: None },
                        caller,
                        bot_initiator: None,
                    },
                )
                .await
            }
            MultiUserChat::Channel(community_id, channel_id) => {
                community_canister_c2c_client::c2c_active_proposal_tallies(
                    community_id.into(),
                    &community_canister::c2c_active_proposal_tallies::Args {
                        args: community_canister::active_proposal_tallies::Args {
                            channel_id,
                            invite_code: None,
                        },
                        caller,
                        bot_initiator: None,
                    },
                )
                .await
            }
        };

        match response {
            Ok(result) => result,
            Err(error) => ActiveTalliesResponse::Error(error.into()),
        }
    } else {
        ActiveTalliesResponse::Error(OCErrorCode::ChatNotFound.into())
    }
}

fn check_chat_is_local(chat: MultiUserChat, state: &RuntimeState) -> bool {
    match chat {
        MultiUserChat::Group(group_id) => state.data.local_groups.contains(&group_id),
        MultiUserChat::Channel(community_id, _) => state.data.local_communities.contains(&community_id),
    }
}
