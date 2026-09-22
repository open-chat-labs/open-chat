use crate::env::ENV;
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::ops::Deref;
use testing::rng::random_string;
use types::{ChannelId, CommunityId, MessageIndex, UnitResult};

// Proposal messages can only be sent by the proposals bot, which is not reachable via ingress in
// these tests, so the successful path is covered by unit tests in `chat_events`. These tests cover
// the membership checks performed by the endpoint.
#[test]
fn register_proposal_vote_v2_rejects_users_who_are_not_channel_members() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        community_id,
        channel_id,
        message_index,
        ..
    } = init_test_data(env, canister_ids, *controller);

    // Non-members are refused by `inspect_message` before the endpoint runs
    let non_member = client::register_user(env, canister_ids);
    let result = env.update_call(
        community_id.into(),
        non_member.principal,
        "register_proposal_vote_v2_msgpack",
        msgpack::serialize_then_unwrap(&community_canister::register_proposal_vote_v2::Args {
            channel_id,
            message_index,
            adopt: true,
        }),
    );
    assert!(result.is_err(), "non-members should be rejected at ingress");

    let community_member = client::register_user(env, canister_ids);
    client::community::happy_path::join_community(env, community_member.principal, community_id);
    let response = register_proposal_vote_v2(env, &community_member, community_id, channel_id, message_index);
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorNotFound)),
        "{response:?}"
    );
}

#[test]
fn register_proposal_vote_v2_rejects_messages_which_are_not_proposals() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        owner,
        community_id,
        channel_id,
        message_index,
    } = init_test_data(env, canister_ids, *controller);

    let response = register_proposal_vote_v2(env, &owner, community_id, channel_id, message_index);
    assert!(matches!(response, UnitResult::Error(e) if e.matches_code(OCErrorCode::ProposalNotFound)));

    let response = register_proposal_vote_v2(env, &owner, community_id, channel_id, message_index.incr());
    assert!(matches!(response, UnitResult::Error(e) if e.matches_code(OCErrorCode::ProposalNotFound)));
}

fn register_proposal_vote_v2(
    env: &mut PocketIc,
    user: &User,
    community_id: CommunityId,
    channel_id: ChannelId,
    message_index: MessageIndex,
) -> UnitResult {
    client::community::register_proposal_vote_v2(
        env,
        user.principal,
        community_id.into(),
        &community_canister::register_proposal_vote_v2::Args {
            channel_id,
            message_index,
            adopt: true,
        },
    )
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let owner = client::register_diamond_user(env, canister_ids, controller);

    let community_id = client::user::happy_path::create_community(env, &owner, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, false, random_string());

    let message_index =
        client::community::happy_path::send_text_message(env, &owner, community_id, channel_id, None, random_string(), None)
            .message_index;

    env.tick();

    TestData {
        owner,
        community_id,
        channel_id,
        message_index,
    }
}

struct TestData {
    owner: User,
    community_id: CommunityId,
    channel_id: ChannelId,
    message_index: MessageIndex,
}
