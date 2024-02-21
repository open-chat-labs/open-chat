use crate::guards::caller_is_openchat_user;
use crate::{read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk::query;
use jwt::Claims;
use local_user_index_canister::access_token::{Response::*, *};
use rand::prelude::StdRng;
use rand::SeedableRng;
use sha256::sha256;
use types::{AccessTokenType, CanisterId, ChannelId, Chat, ChatId, CommunityId, TimestampMillis, UserId, VideoCallClaims};

#[query(composite = true, guard = "caller_is_openchat_user")]
#[trace]
async fn access_token(args: Args) -> Response {
    let Some((user_id, is_diamond)) = read_state(get_user) else {
        return NotAuthorized;
    };

    match args.chat {
        Chat::Direct(chat_id) => {
            let other_user: CanisterId = chat_id.into();
            if (!is_diamond && matches!(args.token_type, AccessTokenType::StartVideoCall))
                || !read_state(|state| state.data.global_users.get_by_user_id(&other_user.into()).is_some())
            {
                return NotAuthorized;
            }
        }
        Chat::Group(chat_id) => {
            if let Err(response) = check_group_access(chat_id, user_id, is_diamond, args.token_type.clone()).await {
                return response;
            }
        }
        Chat::Channel(community_id, channel_id) => {
            if let Err(response) =
                check_channel_access(community_id, channel_id, user_id, is_diamond, args.token_type.clone()).await
            {
                return response;
            }
        }
    }

    read_state(|state| build_token(user_id, args, state))
}

fn get_user(state: &RuntimeState) -> Option<(UserId, bool)> {
    state.data.global_users.get_by_principal(&state.env.caller()).map(|u| {
        (
            u.user_id,
            state.data.global_users.is_diamond_member(&u.user_id, state.env.now()),
        )
    })
}

fn build_token(user_id: UserId, args: Args, state: &RuntimeState) -> Response {
    if let Some(secret_key_der) = state.data.oc_secret_key_der.as_ref() {
        let now = state.env.now();
        let mut rng = seed_rng(&state.data.rng_seed, state.env.caller(), now);

        let expiry = state.env.now() + 300_000;
        let claims = Claims::new(
            expiry,
            args.token_type.to_string(),
            VideoCallClaims {
                user_id,
                chat_id: args.chat.into(),
            },
        );

        match jwt::sign_and_encode_token(secret_key_der, claims, &mut rng) {
            Ok(token) => Success(token),
            Err(err) => InternalError(format!("{err:?}")),
        }
    } else {
        InternalError("OC Secret not set".to_string())
    }
}

fn seed_rng(existing_seed: &[u8; 32], principal: Principal, now: TimestampMillis) -> StdRng {
    let mut seed = Vec::from(existing_seed);
    seed.extend(principal.as_slice());
    seed.extend(now.to_ne_bytes());

    StdRng::from_seed(sha256(&seed))
}

async fn check_group_access(
    chat_id: ChatId,
    user_id: UserId,
    is_diamond: bool,
    access_type: AccessTokenType,
) -> Result<(), Response> {
    match group_canister_c2c_client::c2c_can_issue_access_token(
        chat_id.into(),
        &group_canister::c2c_can_issue_access_token::Args {
            user_id,
            is_diamond,
            access_type,
        },
    )
    .await
    {
        Ok(true) => Ok(()),
        Ok(_) => Err(NotAuthorized),
        Err(err) => Err(InternalError(format!("{err:?}"))),
    }
}

async fn check_channel_access(
    communty_id: CommunityId,
    channel_id: ChannelId,
    user_id: UserId,
    is_diamond: bool,
    access_type: AccessTokenType,
) -> Result<(), Response> {
    match community_canister_c2c_client::c2c_can_issue_access_token_for_channel(
        communty_id.into(),
        &community_canister::c2c_can_issue_access_token_for_channel::Args {
            user_id,
            is_diamond,
            access_type,
            channel_id,
        },
    )
    .await
    {
        Ok(true) => Ok(()),
        Ok(_) => Err(NotAuthorized),
        Err(err) => Err(InternalError(format!("{err:?}"))),
    }
}
