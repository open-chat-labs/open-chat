use crate::client::{local_user_index, user_index};
use crate::env::ENV;
use crate::utils::{tick_many, verify_at_env_time};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use jwt_simple::algorithms::{ECDSAP256PublicKeyLike, ES256PublicKey};
use local_user_index_canister::access_token_v2::StartVideoCallArgs;
use pocket_ic::PocketIc;
use std::error::Error;
use std::ops::Deref;
use testing::rng::random_string;
use types::{ChannelId, Chat, CommunityId, StartVideoCallClaims, VideoCallType};

// Also pins #9455 invariant 12: the start token names the kind of call that was asked for. The
// video bridge learns that a call is audio only from this claim alone.
#[test]
fn access_token_valid() {
    let mut wrapper = ENV.deref().get();

    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    tick_many(env, 10);

    let public_key = user_index::happy_path::public_key(env, canister_ids.user_index);
    let local_user_index = canister_ids.local_user_index(env, community_id);
    let args = |call_type, audio_only| {
        local_user_index_canister::access_token_v2::Args::StartVideoCall(StartVideoCallArgs {
            chat: Chat::Channel(community_id, channel_id),
            call_type,
            audio_only,
        })
    };

    for (call_type, audio_only) in [
        (VideoCallType::Broadcast, false),
        (VideoCallType::Default, false),
        (VideoCallType::Default, true),
    ] {
        let token = local_user_index::happy_path::access_token(env, &user1, local_user_index, &args(call_type, audio_only));

        let claims = decode_and_verify_token(env, token, public_key.clone()).expect("Expected to decode the token");

        assert_eq!(user1.user_id, claims.user_id);
        assert_eq!((claims.call_type, claims.audio_only), (call_type, audio_only));
    }
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);

    // Private, since a public channel in a public community only takes broadcasts
    let community_id =
        client::user::happy_path::create_community(env, &user1, &random_string(), false, vec!["general".to_string()]);

    let summary = client::community::happy_path::summary(env, user1.principal, community_id);

    TestData {
        user1,
        community_id,
        channel_id: summary.channels.first().unwrap().channel_id,
    }
}

fn decode_and_verify_token(
    env: &PocketIc,
    token: String,
    public_key_pem: String,
) -> Result<StartVideoCallClaims, Box<dyn Error>> {
    let public_key = ES256PublicKey::from_pem(&public_key_pem)?;

    let claims = public_key.verify_token(&token, Some(verify_at_env_time(env)))?;

    Ok(claims.custom)
}

struct TestData {
    user1: User,
    community_id: CommunityId,
    channel_id: ChannelId,
}
