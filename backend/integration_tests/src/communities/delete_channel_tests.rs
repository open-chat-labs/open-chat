use crate::client::community::STABLE_MEMORY_MAP_MEMORY_ID;
use crate::env::ENV;
use crate::stable_memory::{STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID, get_stable_memory_map};
use crate::utils::{now_millis, set_freezing_threshold, tick_many, wait_for_cycle_balance_above};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use constants::DAY_IN_MS;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_string;
use types::{CanisterId, ChannelId, CommunityId, OptionUpdate};

#[test_case(true)]
#[test_case(false)]
fn delete_channel_succeeds(as_owner: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id1,
        ..
    } = init_test_data(env, canister_ids, *controller);

    let start = now_millis(env);
    env.advance_time(Duration::from_secs(1));

    let response = client::community::delete_channel(
        env,
        if as_owner { user1.principal } else { user2.principal },
        community_id.into(),
        &community_canister::delete_channel::Args { channel_id: channel_id1 },
    );
    if as_owner {
        assert!(matches!(response, community_canister::delete_channel::Response::Success));
    } else {
        assert!(matches!(
            response,
            community_canister::delete_channel::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)
        ));
    }

    let summary = client::community::happy_path::summary(env, user1.principal, community_id);
    assert_ne!(summary.channels.iter().any(|c| c.channel_id == channel_id1), as_owner);

    let summary_updates = client::community::happy_path::summary_updates(env, user1.principal, community_id, start);
    if as_owner {
        assert!(
            summary_updates
                .unwrap()
                .channels_removed
                .first()
                .is_some_and(|c| *c == channel_id1)
        );
    } else {
        assert!(summary_updates.is_none());
    }
}

#[test]
fn stable_memory_garbage_collected_after_deleting_channel() {
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
        channel_id1,
        channel_id2,
        ..
    } = init_test_data(env, canister_ids, *controller);

    // Make the messages in the first channel expire (though not within this test), so that the
    // channel has expiring events
    client::community::happy_path::update_channel(
        env,
        user1.principal,
        community_id,
        &community_canister::update_channel::Args {
            channel_id: channel_id1,
            name: None,
            description: None,
            rules: None,
            avatar: OptionUpdate::NoChange,
            permissions_v2: None,
            events_ttl: OptionUpdate::SetToSome(DAY_IN_MS),
            gate_config: OptionUpdate::NoChange,
            public: None,
            messages_visible_to_non_members: None,
            external_url: OptionUpdate::NoChange,
        },
    );

    let initial_stable_memory_map_keys = get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_MEMORY_ID).len();
    let initial_small_entries_keys = get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID).len();

    for _ in 0..100 {
        client::community::happy_path::send_text_message(env, &user1, community_id, channel_id1, None, random_string(), None);
    }

    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_MEMORY_ID).len(),
        initial_stable_memory_map_keys + 100
    );
    // A message id, an expiring event and two search index entries (a token and the sender) for each
    // message, plus the sender's metrics
    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID).len(),
        initial_small_entries_keys + 401
    );

    for _ in 0..80 {
        client::community::happy_path::send_text_message(env, &user1, community_id, channel_id2, None, random_string(), None);
    }

    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_MEMORY_ID).len(),
        initial_stable_memory_map_keys + 180
    );
    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID).len(),
        initial_small_entries_keys + 642
    );

    client::community::happy_path::delete_channel(env, user1.principal, community_id, channel_id1);

    env.advance_time(Duration::from_secs(60));
    env.tick();

    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_MEMORY_ID).len(),
        initial_stable_memory_map_keys + 76
    );
    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID).len(),
        initial_small_entries_keys + 241
    );

    client::community::happy_path::delete_channel(env, user1.principal, community_id, channel_id2);

    env.advance_time(Duration::from_secs(60));
    env.tick();

    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_MEMORY_ID).len(),
        initial_stable_memory_map_keys - 7
    );
    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID).len(),
        initial_small_entries_keys
    );
}

// A community checks its cycles balance as its background jobs run, not only as it handles updates,
// so it asks for a top up even while busy only with background work, here garbage collecting the
// stable memory of a deleted channel
#[test]
fn community_asks_for_top_up_while_only_running_background_jobs() {
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
        channel_id1,
        ..
    } = init_test_data(env, canister_ids, *controller);
    let canister_id = CanisterId::from(community_id);
    let local_user_index = canister_ids.local_user_index(env, community_id);

    // Deleting the channel once the balance check is due again runs the check, while the balance is
    // still healthy, so it isn't due again for another 5 minutes. The deletion also schedules the job
    // which garbage collects the channel's stable memory, to run 10 seconds later.
    env.advance_time(Duration::from_secs(6 * 60));
    client::community::happy_path::delete_channel(env, user1.principal, community_id, channel_id1);
    // Lets the community send the events which the deletion pushed, without advancing time
    tick_many(env, 5);

    // Raise the freezing threshold until the cycles it reserves are 60% of the balance, which is less
    // than twice the reserve, so `check_cycles_balance` counts it as low. The rest is enough for the
    // job to ask for a top up, which from a timer takes ~125B liquid cycles: ~40B reserved for the
    // timer's own execution, ~42B for the self-call which ic-cdk-timers runs it via, and ~42B for the
    // call to the LocalUserIndex.
    let balance = env.cycle_balance(canister_id);
    let status = env.canister_status(canister_id, Some(local_user_index)).unwrap();
    let original_freezing_threshold = status.settings.freezing_threshold.clone();
    let burned_per_day: u128 = status.idle_cycles_burned_per_day.0.try_into().unwrap();
    assert!(burned_per_day > 0);
    let freezing_threshold_secs = balance * 6 / 10 * 24 * 60 * 60 / burned_per_day;
    set_freezing_threshold(env, canister_id, local_user_index, freezing_threshold_secs.into());

    // Once the check is due again the job runs, with no update to the community in between, and asks
    // for a top up. Less a margin for the cycles the job and the check themselves use.
    env.advance_time(Duration::from_secs(6 * 60));
    wait_for_cycle_balance_above(env, canister_id, balance + 150_000_000_000);

    // Put the freezing threshold back, since the environment, and so this canister, is shared with
    // later tests
    set_freezing_threshold(env, canister_id, local_user_index, original_freezing_threshold);
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);
    let community_name = random_string();
    let community_id =
        client::user::happy_path::create_community(env, &user1, &community_name, true, vec![random_string(), random_string()]);
    let summary = client::community::happy_path::join_community(env, user2.principal, community_id);
    let channel_id1 = summary.channels.first().unwrap().channel_id;
    let channel_id2 = summary.channels.last().unwrap().channel_id;

    env.tick();

    TestData {
        user1,
        user2,
        community_id,
        channel_id1,
        channel_id2,
    }
}

struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
    channel_id1: ChannelId,
    channel_id2: ChannelId,
}
