use crate::delete_user_tests::{MAX_RESIDUAL_CYCLES, cycles_refunded_metric, wait_for_refund_queue_to_empty};
use crate::env::ENV;
use crate::utils::{tick_many, tick_until, wait_for_deleted_canister_to_be_uninstalled};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use group_index_canister::freeze_group::SuspensionDetails;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{CanisterId, ChatId, MessageContentInitial, TextContent};

#[test]
fn freeze_then_unfreeze() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, group_id, .. } = init_test_data(env, canister_ids, *controller);

    client::group_index::freeze_group(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::freeze_group::Args {
            chat_id: group_id,
            reason: None,
            suspend_members: None,
        },
    );

    let summary_args = group_canister::public_summary::Args { invite_code: None };

    if let group_canister::public_summary::Response::Success(res) =
        client::group::public_summary(env, user1.principal, group_id.into(), &summary_args)
    {
        assert!(res.summary.frozen.is_some());
    } else {
        panic!()
    }

    client::group_index::unfreeze_group(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::unfreeze_group::Args { chat_id: group_id },
    );

    if let group_canister::public_summary::Response::Success(res) =
        client::group::public_summary(env, user1.principal, group_id.into(), &summary_args)
    {
        assert!(res.summary.frozen.is_none());
    } else {
        panic!()
    }
}

#[test]
fn frozen_group_rejects_updates_other_than_those_exempted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1, user2, group_id, ..
    } = init_test_data(env, canister_ids, *controller);

    client::group_index::freeze_group(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::freeze_group::Args {
            chat_id: group_id,
            reason: None,
            suspend_members: None,
        },
    );

    // Sending a message is rejected
    let send_message_args = group_canister::send_message_v2::Args {
        thread_root_message_index: None,
        message_id: random_from_u128(),
        content: MessageContentInitial::Text(TextContent {
            text: "hello".to_string(),
        }),
        sender_name: user2.username(),
        sender_display_name: None,
        replies_to: None,
        mentioned: Vec::new(),
        forwarding: false,
        block_level_markdown: false,
        rules_accepted: None,
        message_filter_failed: None,
        new_achievement: false,
        og_previews: Vec::new(),
    };
    let error = env
        .update_call(
            group_id.into(),
            user2.principal,
            "send_message_v2_msgpack",
            msgpack::serialize_then_unwrap(&send_message_args),
        )
        .unwrap_err();
    assert!(error.reject_message.contains("Canister is frozen"), "{error:?}");

    // Unfreezing is exempt, so still succeeds
    client::group_index::unfreeze_group(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::unfreeze_group::Args { chat_id: group_id },
    );

    // Once unfrozen, sending a message succeeds
    client::group::happy_path::send_text_message(env, &user2, group_id, None, "hello", None);
}

// A group frozen by a platform moderator still applies the changes other canisters send it to keep
// it in step, such as its verification, which the GroupIndex passes on via its LocalUserIndex
#[test]
fn frozen_group_still_applies_changes_from_other_canisters() {
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
        group_id,
        group_name,
    } = init_test_data(env, canister_ids, *controller);

    client::group_index::freeze_group(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::freeze_group::Args {
            chat_id: group_id,
            reason: None,
            suspend_members: None,
        },
    );

    client::group_index::happy_path::set_group_verification(env, *controller, canister_ids.group_index, group_id, group_name);

    tick_until(env, |env| {
        client::group::happy_path::summary(env, user2.principal, group_id).verified
    });

    let summary = client::group::happy_path::summary(env, user2.principal, group_id);
    assert!(summary.frozen.is_some());
}

#[test]
fn frozen_community_still_applies_changes_from_other_canisters() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, .. } = init_test_data(env, canister_ids, *controller);

    let community_name = random_string();
    let community_id =
        client::user::happy_path::create_community(env, &user2, &community_name, true, vec!["general".to_string()]);

    let response = client::group_index::freeze_community(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::freeze_community::Args {
            community_id,
            reason: None,
            suspend_members: None,
        },
    );
    assert!(
        matches!(response, group_index_canister::freeze_community::Response::Success(_)),
        "{response:?}"
    );

    client::group_index::happy_path::set_community_verification(
        env,
        *controller,
        canister_ids.group_index,
        community_id,
        community_name,
    );

    tick_until(env, |env| {
        client::community::happy_path::summary(env, user2.principal, community_id).verified
    });

    let summary = client::community::happy_path::summary(env, user2.principal, community_id);
    assert!(summary.frozen.is_some());
}

// A group being imported into a community is frozen too, but rejects the changes other canisters
// send it, since its state has already been exported and they would be lost. They are retried, and
// applied once the import is abandoned by unfreezing the group.
#[test]
fn group_being_imported_into_a_community_rejects_changes_from_other_canisters() {
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
        group_id,
        group_name,
    } = init_test_data(env, canister_ids, *controller);

    let community_id =
        client::user::happy_path::create_community(env, &user2, &random_string(), true, vec!["general".to_string()]);

    client::community::happy_path::import_group(env, user2.principal, community_id, group_id);

    // Stopping the community leaves the import unfinished, so the group stays frozen for it
    client::stop_canister(env, canister_ids.local_user_index(env, community_id), community_id.into());

    client::group_index::happy_path::set_group_verification(env, *controller, canister_ids.group_index, group_id, group_name);

    // Long enough for the LocalUserIndex's first attempt and, 5 minutes after it traps, its retry
    for _ in 0..40 {
        env.advance_time(Duration::from_secs(10));
        env.tick();
    }
    let summary = client::group::happy_path::summary(env, user2.principal, group_id);
    assert!(summary.frozen.is_some());
    assert!(!summary.verified, "the group applied a change while being imported");

    // Unfreezing the group abandons the import, after which the change is applied
    client::group_index::unfreeze_group(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::unfreeze_group::Args { chat_id: group_id },
    );

    // The LocalUserIndex retries a trapped call after 5 minutes
    env.advance_time(Duration::from_secs(5 * 60));
    tick_until(env, |env| {
        client::group::happy_path::summary(env, user2.principal, group_id).verified
    });

    // The community is left stopped with its import unfinished
    wrapper.discard();
}

#[test]
fn can_only_be_called_by_platform_moderator() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1, user2, group_id, ..
    } = init_test_data(env, canister_ids, *controller);

    let freeze_args = group_index_canister::freeze_group::Args {
        chat_id: group_id,
        reason: None,
        suspend_members: None,
    };

    let response1 = client::group_index::freeze_group(env, user2.principal, canister_ids.group_index, &freeze_args);
    assert!(matches!(
        response1,
        group_index_canister::freeze_group::Response::NotAuthorized
    ));

    let response2 = client::group_index::freeze_group(env, user1.principal, canister_ids.group_index, &freeze_args);
    assert!(
        matches!(response2, group_index_canister::freeze_group::Response::Success(_)),
        "{response2:#?}",
    );

    let unfreeze_args = group_index_canister::unfreeze_group::Args { chat_id: group_id };

    let response3 = client::group_index::unfreeze_group(env, user2.principal, canister_ids.group_index, &unfreeze_args);
    assert!(matches!(
        response3,
        group_index_canister::unfreeze_group::Response::NotAuthorized
    ));

    let response4 = client::group_index::unfreeze_group(env, user1.principal, canister_ids.group_index, &unfreeze_args);
    assert!(matches!(
        response4,
        group_index_canister::unfreeze_group::Response::Success(_)
    ));
}

#[test]
fn search_excludes_frozen_groups() {
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
        group_id,
        group_name,
    } = init_test_data(env, canister_ids, *controller);

    let search_args = group_index_canister::search::Args {
        search_term: group_name,
        max_results: 10,
    };

    if let group_index_canister::search::Response::Success(res) =
        client::group_index::search(env, user2.principal, canister_ids.group_index, &search_args)
    {
        assert_eq!(res.matches.len(), 1);
    } else {
        panic!()
    }

    client::group_index::freeze_group(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::freeze_group::Args {
            chat_id: group_id,
            reason: None,
            suspend_members: None,
        },
    );

    if let group_index_canister::search::Response::Success(res) =
        client::group_index::search(env, user2.principal, canister_ids.group_index, &search_args)
    {
        assert!(res.matches.is_empty());
    } else {
        panic!()
    }
}

#[test]
fn freeze_and_suspend_users() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1, user2, group_id, ..
    } = init_test_data(env, canister_ids, *controller);

    client::group_index::freeze_group(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::freeze_group::Args {
            chat_id: group_id,
            reason: None,
            suspend_members: Some(SuspensionDetails {
                duration: None,
                reason: "spam".to_string(),
            }),
        },
    );

    tick_many(env, 3);

    let user = client::user_index::happy_path::current_user(env, user2.principal, canister_ids.user_index);

    assert!(user.suspension_details.is_some());

    client::group_index::unfreeze_group(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::unfreeze_group::Args { chat_id: group_id },
    );

    // The suspension reached the group despite it being frozen at the time, so once it is unfrozen
    // the suspended member still can't send messages
    let response = client::group::send_message_v2(
        env,
        user2.principal,
        group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::Text(TextContent {
                text: "spam".to_string(),
            }),
            sender_name: user2.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(&response, group_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorSuspended)),
        "{response:?}"
    );
}

#[test]
fn delete_frozen_group() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, group_id, .. } = init_test_data(env, canister_ids, *controller);
    let canister_id = CanisterId::from(group_id);
    let local_user_index = canister_ids.local_user_index(env, group_id);

    client::group_index::freeze_group(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::freeze_group::Args {
            chat_id: group_id,
            reason: None,
            suspend_members: None,
        },
    );

    // So that the refunds counted below are only this group's
    wait_for_refund_queue_to_empty(env, local_user_index);
    let balance_before = env.cycle_balance(canister_id);
    let refunded_before = cycles_refunded_metric(env, local_user_index);

    let delete_group_response = client::group_index::delete_frozen_group(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::delete_frozen_group::Args { chat_id: group_id },
    );
    assert!(
        matches!(
            delete_group_response,
            group_index_canister::delete_frozen_group::Response::Success
        ),
        "{delete_group_response:?}"
    );

    wait_for_deleted_canister_to_be_uninstalled(env, canister_id);

    // A frozen group can't refund its own cycles as a group deleting itself does, so they were all
    // still in its canister, which the LocalUserIndex then refunds them from. That waits out the
    // IC's install_code rate limit on the group's canister, so time is advanced.
    let mut refunded = 0;
    for _ in 0..50 {
        refunded = cycles_refunded_metric(env, local_user_index) - refunded_before;
        if refunded > balance_before - MAX_RESIDUAL_CYCLES {
            break;
        }
        env.advance_time(Duration::from_secs(60));
        tick_many(env, 5);
    }
    assert!(refunded > balance_before - MAX_RESIDUAL_CYCLES, "{refunded}");

    // The canister is kept, uninstalled, rather than deleted along with what couldn't be refunded
    tick_many(env, 5);
    assert!(env.canister_exists(canister_id));
    let canister_status = env.canister_status(canister_id, Some(local_user_index)).unwrap();
    assert!(canister_status.module_hash.is_none());

    wrapper.discard();
}

// The LocalUserIndex refunds a deleted frozen group's cycles by installing the refunder in its
// canister. An upgrade part way through clears what it was doing, but the canister is still at the
// front of the queue, so the refund is picked up again and completed.
#[test]
fn deleted_groups_refund_resumes_after_the_local_user_index_is_upgraded_mid_way() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, group_id, .. } = init_test_data(env, canister_ids, *controller);
    let canister_id = CanisterId::from(group_id);
    let local_user_index = canister_ids.local_user_index(env, group_id);

    client::group_index::freeze_group(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::freeze_group::Args {
            chat_id: group_id,
            reason: None,
            suspend_members: None,
        },
    );

    // So that the refunds counted below are only this group's
    wait_for_refund_queue_to_empty(env, local_user_index);
    let balance_before = env.cycle_balance(canister_id);
    let refunded_before = cycles_refunded_metric(env, local_user_index);

    let response = client::group_index::delete_frozen_group(
        env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::delete_frozen_group::Args { chat_id: group_id },
    );
    assert!(
        matches!(response, group_index_canister::delete_frozen_group::Response::Success),
        "{response:?}"
    );
    wait_for_deleted_canister_to_be_uninstalled(env, canister_id);

    // Wait until the refunder has been installed but not yet uninstalled. The IC's install_code rate
    // limit on the group's canister makes the LocalUserIndex retry after a delay, so time is advanced.
    let mut refunder_installed = false;
    for _ in 0..500 {
        env.advance_time(Duration::from_secs(10));
        env.tick();
        if env
            .canister_status(canister_id, Some(local_user_index))
            .unwrap()
            .module_hash
            .is_some()
        {
            refunder_installed = true;
            break;
        }
    }
    assert!(refunder_installed);

    let wasm = crate::wasms::LOCAL_USER_INDEX.clone();
    let args = candid::encode_one(local_user_index_canister::post_upgrade::Args {
        wasm_version: wasm.version,
    })
    .unwrap();
    client::stop_canister(env, canister_ids.user_index, local_user_index);
    env.upgrade_canister(local_user_index, wasm.module.into(), args, Some(canister_ids.user_index))
        .unwrap();
    client::start_canister(env, canister_ids.user_index, local_user_index);

    wait_for_refund_queue_to_empty(env, local_user_index);
    let refunded = cycles_refunded_metric(env, local_user_index) - refunded_before;
    assert!(refunded > balance_before - MAX_RESIDUAL_CYCLES, "{refunded}");
    let canister_status = env.canister_status(canister_id, Some(local_user_index)).unwrap();
    assert!(canister_status.module_hash.is_none());

    // The LocalUserIndex was upgraded
    wrapper.discard();
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_diamond_user(env, canister_ids, controller);

    client::user_index::add_platform_moderator(
        env,
        controller,
        canister_ids.user_index,
        &user_index_canister::add_platform_moderator::Args { user_id: user1.user_id },
    );

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user2, &group_name, true, true);

    TestData {
        user1,
        user2,
        group_id,
        group_name,
    }
}

struct TestData {
    user1: User,
    user2: User,
    group_id: ChatId,
    group_name: String,
}
