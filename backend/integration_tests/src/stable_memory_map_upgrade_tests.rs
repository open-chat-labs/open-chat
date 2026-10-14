use crate::env::ENV;
use crate::utils::{metrics, tick_many, try_metrics};
use crate::{TestEnv, client, wasms};
use pocket_ic::PocketIc;
use std::collections::BTreeMap;
use std::ops::Deref;
use testing::rng::random_string;
use types::{BuildVersion, CanisterId, CanisterWasm, ChatEvent};

// The ids of each canister's stable memory maps: the map, then the map for small entries
const GROUP_STABLE_MEMORY_MAPS: [u8; 2] = [3, 4];
const MULTI_USER_STABLE_MEMORY_MAPS: [u8; 2] = [1, 2];

#[test]
fn stable_memory_maps_survive_upgrades() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), false, true);
    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), false, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, false, random_string());

    let direct_event = client::user::happy_path::send_text_message(env, &user1, user2.user_id, "direct", None).event_index;
    let group_event = client::group::happy_path::send_text_message(env, &user1, group_id, None, "group", None).event_index;
    let channel_event =
        client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, "channel", None)
            .event_index;
    tick_many(env, 3);

    let canisters: [(CanisterId, [u8; 2]); 3] = [
        (user1.canister(), MULTI_USER_STABLE_MEMORY_MAPS),
        (group_id.into(), GROUP_STABLE_MEMORY_MAPS),
        (community_id.into(), GROUP_STABLE_MEMORY_MAPS),
    ];
    for (canister_id, memory_ids) in canisters {
        assert_stable_memory_maps_initialised(env, canister_id, memory_ids);
    }

    let version = BuildVersion::new(0, 0, 1);
    let wasm = |module: &CanisterWasm| CanisterWasm {
        version,
        module: module.module.clone(),
    };
    client::user_index::happy_path::upgrade_multi_user_canister_wasm(
        env,
        *controller,
        canister_ids.user_index,
        wasm(&wasms::MULTI_USER),
    );
    client::group_index::happy_path::upgrade_group_canister_wasm(
        env,
        *controller,
        canister_ids.group_index,
        wasm(&wasms::GROUP),
    );
    client::group_index::happy_path::upgrade_community_canister_wasm(
        env,
        *controller,
        canister_ids.group_index,
        wasm(&wasms::COMMUNITY),
    );

    // Every canister in the environment is upgraded, so how long that takes depends on how many
    // earlier tests have created, and until then a canister may be stopped for its upgrade
    for (canister_id, memory_ids) in canisters {
        wait_for_wasm_version(env, canister_id, version);
        assert_stable_memory_maps_initialised(env, canister_id, memory_ids);
    }

    let direct = client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![direct_event]);
    let group = client::group::happy_path::events_by_index(env, &user1, group_id, vec![group_event]);
    let channel = client::community::happy_path::events_by_index(env, &user1, community_id, channel_id, vec![channel_event]);
    for response in [direct, group, channel] {
        assert_eq!(response.events.len(), 1);
        assert!(matches!(response.events[0].event, ChatEvent::Message(_)));
    }

    // The MultiUser canister has rewritten its direct chats, none of which held data on the heap
    let rewrite = metrics(env, user1.canister())["direct_chats_rewrite"].clone();
    assert_eq!(rewrite["complete"], true);
    assert_eq!(rewrite["chats_left"], 0);

    // Upgrading every canister to a new version would break later tests which draw this env
    wrapper.discard();
}

// Creating a map writes its header, so each map's memory is non-empty once it has been initialised
fn assert_stable_memory_maps_initialised(env: &PocketIc, canister_id: CanisterId, memory_ids: [u8; 2]) {
    let sizes: BTreeMap<u8, u64> = serde_json::from_value(metrics(env, canister_id)["stable_memory_sizes"].clone()).unwrap();

    for memory_id in memory_ids {
        assert!(
            sizes.get(&memory_id).is_some_and(|size| *size > 0),
            "{canister_id}: stable memory map {memory_id} not initialised: {sizes:?}"
        );
    }
}

fn wait_for_wasm_version(env: &mut PocketIc, canister_id: CanisterId, version: BuildVersion) {
    for _ in 0..300 {
        if try_metrics(env, canister_id)
            .and_then(|metrics| serde_json::from_value::<BuildVersion>(metrics["wasm_version"].clone()).ok())
            == Some(version)
        {
            return;
        }
        env.tick();
    }
    panic!("{canister_id} not upgraded");
}
