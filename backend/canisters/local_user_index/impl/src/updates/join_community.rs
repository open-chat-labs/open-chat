use crate::guards::caller_is_openchat_user;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::join_community::{Response::*, *};

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn join_community(args: Args) -> Response {
    let (user_details, previous_user_ids) = mutate_state(|state| {
        let user_details = state.get_calling_user_and_process_credentials(args.verified_credential_args.as_ref());
        let previous_user_ids = state.data.migrated_user_ids.previous_ids(user_details.user_id);
        (user_details, previous_user_ids)
    });

    let is_bot = user_details.user_type.is_bot();

    let c2c_args = community_canister::c2c_join_community::Args {
        user_id: user_details.user_id,
        principal: user_details.principal,
        channel_id: None,
        invite_code: args.invite_code,
        referred_by: args.referred_by,
        is_platform_moderator: user_details.is_platform_moderator,
        user_type: user_details.user_type,
        diamond_membership_expires_at: user_details.diamond_membership_expires_at,
        verified_credential_args: args.verified_credential_args,
        unique_person_proof: user_details.unique_person_proof.clone(),
        total_chit_earned: user_details.chit.total_earned,
        composite_gate_index: args.composite_gate_index,
        previous_user_ids,
    };
    match community_canister_c2c_client::c2c_join_community(args.community_id.into(), &c2c_args).await {
        Ok(response) => match response {
            community_canister::c2c_join_community::Response::Success(s) => {
                if !is_bot {
                    mutate_state(|state| state.notify_user_joined_community(user_details.user_id, &s, state.env.now()));
                }
                Success(s)
            }
            community_canister::c2c_join_community::Response::AlreadyInCommunity(s) => {
                if !is_bot {
                    mutate_state(|state| state.notify_user_joined_community(user_details.user_id, &s, state.env.now()));
                }
                AlreadyInCommunity(s)
            }
            community_canister::c2c_join_community::Response::GateCheckFailed(reason) => GateCheckFailed(reason),
            community_canister::c2c_join_community::Response::Error(error) => Error(error),
        },
        Err(error) => Error(error.into()),
    }
}
