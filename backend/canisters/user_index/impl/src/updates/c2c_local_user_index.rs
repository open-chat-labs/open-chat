use crate::guards::caller_is_local_user_index_canister;
use crate::{RuntimeState, UserIdentity, UserRegisteredEventPayload, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use constants::ONE_MB;
use event_store_producer::EventBuilder;
use group_index_canister::UserIndexEvent as GroupIndexEvent;
use local_user_index_canister::{
    ChitBalance, ImportUser, OpenChatBotMessageV2, UserIndexEvent, UserJoinedCommunityOrChannel, UserJoinedGroup,
    UserRegistered, UsernameChanged,
};
use oc_error_codes::OCErrorCode;
use rand::Rng;
use stable_memory_map::StableMemoryMap;
use std::cell::LazyCell;
use storage_index_canister::add_or_update_users::UserConfig;
use tracing::{error, info};
use types::{CanisterId, Hash, IdempotentEnvelope, MessageContentInitial, TextContent, TimestampMillis, UserId, UserType};
use user_index_canister::c2c_local_user_index::*;
use user_index_canister::{LocalUserIndexEvent, UserImportFailed, UserMigrationFailedToStart};

#[update(guard = "caller_is_local_user_index_canister", msgpack = true)]
#[trace]
fn c2c_local_user_index(args: Args) -> Response {
    mutate_state(|state| c2c_local_user_index_impl(args, state))
}

fn c2c_local_user_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller: CanisterId = state.env.caller();
    let now = LazyCell::new(now_millis);
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            handle_event(event.value, event.created_at, caller, &now, state);
        }
    }

    Response::Success
}

// Cancels the user's migration, unfreezing their canister, once it is no longer being tracked. If
// this fails the migration can be cancelled with `cancel_user_migration`.
fn cancel_migration(user_id: UserId, multi_user_canister_id: CanisterId, user_hash: Option<Hash>) {
    utils::async_work::spawn_tracked(async move {
        match crate::updates::cancel_user_migration::cancel_migration(user_id, multi_user_canister_id, user_hash).await {
            Ok(()) => info!(%user_id, "User migration cancelled"),
            Err(error) => error!(%user_id, ?error, "Failed to cancel user migration"),
        }
    });
}

async fn cancel_failed_import(ev: UserImportFailed) {
    match crate::updates::cancel_user_migration::cancel_migration(ev.user_id, ev.multi_user_canister_id, Some(ev.user_hash))
        .await
    {
        Ok(()) => mutate_state(|state| {
            let now = state.env.now();
            if state
                .data
                .user_migrations
                .mark_import_failed(ev.user_id, ev.multi_user_canister_id, ev.user_hash, ev.error, now)
            {
                info!(user_id = %ev.user_id, "User migration cancelled after its import failed");
                crate::jobs::start_user_migrations::run(state);
            }
        }),
        Err(error) => error!(user_id = %ev.user_id, ?error, "Failed to cancel user migration after its import failed"),
    }
}

async fn cancel_failed_start(ev: UserMigrationFailedToStart) {
    match crate::updates::cancel_user_migration::cancel_migration(ev.user_id, ev.multi_user_canister_id, None).await {
        Ok(()) => mutate_state(|state| {
            let now = state.env.now();
            if state
                .data
                .user_migrations
                .mark_failed(ev.user_id, ev.multi_user_canister_id, ev.error, now)
            {
                crate::jobs::start_user_migrations::run(state);
            }
        }),
        Err(error) => error!(user_id = %ev.user_id, ?error, "Failed to cancel user migration after it failed to start"),
    }
}

fn handle_event<F: FnOnce() -> TimestampMillis>(
    event: LocalUserIndexEvent,
    event_timestamp: TimestampMillis,
    caller: Principal,
    now: &LazyCell<TimestampMillis, F>,
    state: &mut RuntimeState,
) {
    match event {
        LocalUserIndexEvent::UserRegistered(ev) => {
            process_new_user(ev.principal, ev.username, ev.email, ev.user_id, ev.referred_by, caller, state)
        }
        LocalUserIndexEvent::UserJoinedGroup(ev) => {
            state.push_event_to_local_user_index(
                ev.user_id,
                UserIndexEvent::UserJoinedGroup(UserJoinedGroup {
                    user_id: ev.user_id,
                    chat_id: ev.chat_id,
                    local_user_index_canister_id: ev.local_user_index_canister_id,
                    latest_message_index: ev.latest_message_index,
                    group_canister_timestamp: ev.group_canister_timestamp,
                }),
            );
        }
        LocalUserIndexEvent::UserJoinedCommunityOrChannel(ev) => {
            state.push_event_to_local_user_index(
                ev.user_id,
                UserIndexEvent::UserJoinedCommunityOrChannel(UserJoinedCommunityOrChannel {
                    user_id: ev.user_id,
                    community_id: ev.community_id,
                    local_user_index_canister_id: ev.local_user_index_canister_id,
                    channels: ev.channels,
                    community_canister_timestamp: ev.community_canister_timestamp,
                }),
            );
        }
        LocalUserIndexEvent::OpenChatBotMessageV2(ev) => {
            state.push_event_to_local_user_index(
                ev.user_id,
                UserIndexEvent::OpenChatBotMessageV2(Box::new(OpenChatBotMessageV2 {
                    user_id: ev.user_id,
                    thread_root_message_id: ev.thread_root_message_id,
                    content: ev.content,
                    mentioned: ev.mentioned,
                })),
            );
        }
        LocalUserIndexEvent::UserSetProfileBackground(ev) => {
            let (user_id, profile_background_id) = *ev;
            state
                .data
                .users
                .set_profile_background_id(&user_id, profile_background_id, **now);
        }
        LocalUserIndexEvent::NotifyUniquePersonProof(ev) => {
            let (user_id, proof) = *ev;
            state
                .data
                .users
                .record_proof_of_unique_personhood(user_id, proof.clone(), **now);
            state.push_event_to_all_local_user_indexes(UserIndexEvent::NotifyUniquePersonProof(user_id, proof), Some(caller));
        }
        LocalUserIndexEvent::NotifyChit(ev) => {
            let (user_id, chit) = *ev;

            if state.data.users.set_chit(
                &user_id,
                chit.total_chit_earned,
                chit.timestamp,
                chit.chit_balance,
                chit.chit_balance_v2,
                chit.streak,
                chit.streak_ends,
                **now,
            ) && let Some(user) = state.data.users.get_by_user_id(&user_id)
            {
                let total_chit_earned = user.total_chit_earned;
                state.data.chit_leaderboard.update_position(
                    user_id,
                    total_chit_earned,
                    chit.chit_balance,
                    chit.timestamp,
                    **now,
                );

                state.push_event_to_all_local_user_indexes(
                    UserIndexEvent::UpdateChitBalance(
                        user_id,
                        ChitBalance {
                            total_earned: total_chit_earned,
                            curr_balance: user.chit_balance,
                            streak: user.streak,
                            streak_ends: user.streak_ends,
                        },
                    ),
                    None,
                );
            }
        }
        LocalUserIndexEvent::NotifyPremiumItemPurchased(ev) => {
            let (user_id, purchase) = *ev;
            state.data.premium_items.log_purchase(
                user_id,
                purchase.item_id,
                purchase.paid_in_chat,
                purchase.cost,
                purchase.timestamp,
            );
        }
        LocalUserIndexEvent::NotifyStreakInsurancePayment(payment) => state.data.streak_insurance_logs.mark_payment(*payment),
        LocalUserIndexEvent::NotifyStreakInsuranceClaim(claim) => state.data.streak_insurance_logs.mark_claim(*claim),
        LocalUserIndexEvent::MediaScanStalled(ev) => {
            // The off-chain media_hasher worker has stopped consuming a local index's scan
            // job log. Raised in the internal moderation channel because that is the surface
            // the moderation team already watches - queued jobs are potentially unscanned
            // CSAM, and log overflow silently drops the oldest.
            crate::model::moderation::post_moderation_notice(
                format!(
                    "\u{26a0} Media scan pipeline stalled on local index {caller}: {} jobs pending, oldest waiting ~{} minutes with no verdicts submitted. The media_hasher worker needs investigation.",
                    ev.jobs_pending,
                    ev.oldest_job_age / 60_000,
                ),
                state,
            );
        }
        LocalUserIndexEvent::MediaScanRecovered => {
            crate::model::moderation::post_moderation_notice(
                format!("\u{2705} Media scan pipeline recovered on local index {caller}: verdicts are flowing again."),
                state,
            );
        }
        LocalUserIndexEvent::MultiUserCanisterCreated(canister_id) => {
            // Recorded here rather than in the `create_multi_user_canister` handler so
            // that the mapping survives a dropped reply - the local index keeps retrying this
            // event until it is acked, and re-adding is a no-op
            if state.data.multi_user_canisters.add(canister_id, caller, event_timestamp) {
                info!(%canister_id, local_user_index_canister_id = %caller, "MultiUser canister registered");
                // Users may be queued for migration, waiting for a MultiUser canister
                crate::jobs::start_user_migrations::run(state);
            }
        }
        LocalUserIndexEvent::UserMigrationStarted(ev) => {
            if state.data.user_migrations.mark_started(
                ev.user_id,
                ev.multi_user_canister_id,
                ev.user_bytes,
                ev.wasm_version,
                ev.user_hash,
                **now,
            ) {
                info!(user_id = %ev.user_id, multi_user_canister_id = %ev.multi_user_canister_id, "User migration started");
                // The MultiUser canister is told to import the user by the LocalUserIndex which
                // controls it. Tests may migrate users to other canisters, which aren't told.
                if let Some(local_user_index) = state.data.multi_user_canisters.local_user_index(&ev.multi_user_canister_id) {
                    state.push_event_to_local_user_index_canister(
                        local_user_index,
                        UserIndexEvent::ImportUser(ImportUser {
                            user_id: ev.user_id,
                            multi_user_canister_id: ev.multi_user_canister_id,
                            user_hash: ev.user_hash,
                        }),
                    );
                }
            } else if !state.data.user_migrations.is_imported(&ev.user_id) {
                // The migration is no longer being tracked, eg. because it was cancelled while the
                // user's canister was being asked to start it, so it is cancelled rather than leaving
                // the canister frozen. The MultiUser canister was never told to import the user.
                info!(user_id = %ev.user_id, multi_user_canister_id = %ev.multi_user_canister_id, "Untracked user migration started");
                cancel_migration(ev.user_id, ev.multi_user_canister_id, None);
            }
        }
        LocalUserIndexEvent::UserImported(ev) => {
            if state
                .data
                .user_migrations
                .mark_imported(ev.old_user_id, ev.new_user_id, **now)
            {
                if state.switch_over_migrated_user(ev.old_user_id, ev.new_user_id, ev.canisters_to_notify, ev.users_to_notify) {
                    info!(old_user_id = %ev.old_user_id, new_user_id = %ev.new_user_id, "User imported and switched over");
                } else {
                    error!(old_user_id = %ev.old_user_id, new_user_id = %ev.new_user_id, "User imported but not switched over");
                }
                crate::jobs::start_user_migrations::run(state);
            }
        }
        LocalUserIndexEvent::UserImportFailed(ev) => {
            // The migration is only recorded as failed once it has been cancelled. If it can't be,
            // eg. because the MultiUser canister can't be reached to abandon the import, it is left
            // in progress, to be cancelled once it has stalled.
            // The failure of an earlier migration's import is ignored.
            if state
                .data
                .user_migrations
                .get(&ev.user_id)
                .filter(|m| m.multi_user_canister_id == ev.multi_user_canister_id)
                .and_then(|m| m.started.as_ref())
                .is_some_and(|s| s.user_hash == ev.user_hash)
            {
                info!(user_id = %ev.user_id, multi_user_canister_id = %ev.multi_user_canister_id, error = ?ev.error, "User import failed");
                utils::async_work::spawn_tracked(cancel_failed_import(*ev));
            }
        }
        LocalUserIndexEvent::UserMigrationFailedToStart(ev) => {
            if ev.error.matches_code(OCErrorCode::C2CError) {
                // The call to start the migration may have frozen the user's canister even though its
                // reply was lost, so the migration is cancelled before being recorded as failed. If
                // it can't be, eg. because the canister still can't be reached, it is left in
                // progress, to be cancelled once it has stalled.
                if state
                    .data
                    .user_migrations
                    .get(&ev.user_id)
                    .is_some_and(|m| m.multi_user_canister_id == ev.multi_user_canister_id && m.started.is_none())
                {
                    info!(user_id = %ev.user_id, multi_user_canister_id = %ev.multi_user_canister_id, error = ?ev.error, "User migration failed to start");
                    utils::async_work::spawn_tracked(cancel_failed_start(*ev));
                }
            } else if state
                .data
                .user_migrations
                .mark_failed(ev.user_id, ev.multi_user_canister_id, ev.error.clone(), **now)
            {
                info!(user_id = %ev.user_id, multi_user_canister_id = %ev.multi_user_canister_id, error = ?ev.error, "User migration failed to start");
                crate::jobs::start_user_migrations::run(state);
            }
        }
        LocalUserIndexEvent::NotifyOfUserDeleted(c, u) => state.data.group_index_event_sync_queue.push(IdempotentEnvelope {
            created_at: **now,
            idempotency_id: state.env.rng().next_u64(),
            value: GroupIndexEvent::NotifyOfUserDeleted(c, u),
        }),
        LocalUserIndexEvent::BotInstalled(ev) => {
            state.data.users.add_bot_installation(
                ev.bot_id,
                ev.location,
                caller,
                ev.granted_permissions,
                ev.granted_autonomous_permissions,
                ev.installed_by,
                event_timestamp,
            );
        }
        LocalUserIndexEvent::BotUninstalled(ev) => {
            state
                .data
                .users
                .remove_bot_installation(ev.bot_id, ev.location, ev.uninstalled_by, event_timestamp);
        }
        // A migrated user may still be named by their old id, eg. by the canisters of those who had
        // blocked them before, whereas the pairs are held under their latest id
        LocalUserIndexEvent::UserBlocked(user_id, blocked) => {
            let user_id = state.data.migrated_user_ids.latest(user_id);
            let blocked = state.data.migrated_user_ids.latest(blocked);
            state.data.blocked_users.insert((blocked, user_id), ());
            state.push_event_to_all_local_user_indexes(UserIndexEvent::UserBlocked(user_id, blocked), Some(caller));
        }
        LocalUserIndexEvent::UserUnblocked(user_id, unblocked) => {
            let user_id = state.data.migrated_user_ids.latest(user_id);
            let unblocked = state.data.migrated_user_ids.latest(unblocked);
            state.data.blocked_users.remove(&(unblocked, user_id));
            state.push_event_to_all_local_user_indexes(UserIndexEvent::UserUnblocked(user_id, unblocked), Some(caller));
        }
        LocalUserIndexEvent::SetMaxStreak(user_id, max_streak) => state.data.users.set_max_streak(&user_id, max_streak),
        LocalUserIndexEvent::EventForMigratedUser(ev) => {
            let user_id = state.data.migrated_user_ids.latest(ev.user_id);
            state.push_event_to_local_user_index(
                user_id,
                UserIndexEvent::EventForMigratedUser(Box::new(local_user_index_canister::EventForMigratedUser {
                    user_id,
                    event: ev.event,
                })),
            );
        }
        LocalUserIndexEvent::DailyPuzzleDataForMigratedUser(ev) => {
            let user_id = state.data.migrated_user_ids.latest(ev.user_id);
            state.push_event_to_local_user_index(
                user_id,
                UserIndexEvent::DailyPuzzleDataForMigratedUser(Box::new(
                    local_user_index_canister::DailyPuzzleDataForMigratedUser { user_id, data: ev.data },
                )),
            );
        }
    }
}

fn process_new_user(
    principal: Principal,
    username: String,
    email: Option<String>,
    user_id: UserId,
    referred_by: Option<UserId>,
    local_user_index_canister_id: CanisterId,
    state: &mut RuntimeState,
) {
    let now = state.env.now();

    let mut original_username = None;
    let username = match state.data.users.ensure_unique_username(&username, false) {
        Ok(_) => username,
        Err(new_username) => {
            original_username = Some(username);
            new_username
        }
    };

    state.data.users.register(
        principal,
        user_id,
        username.clone(),
        None,
        now,
        referred_by,
        UserType::User,
        None,
    );

    if state.data.local_index_map.add_user(local_user_index_canister_id, user_id) {
        state.data.multi_user_canisters.on_user_added(&user_id);
    }

    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::UserRegistered(UserRegistered {
            user_id,
            user_principal: principal,
            username: username.clone(),
            user_type: UserType::User,
            referred_by,
        }),
        Some(local_user_index_canister_id),
    );

    state.data.event_store_client.push(
        EventBuilder::new("user_registered", now)
            .with_user(user_id.to_string(), true)
            .with_source(state.env.canister_id().to_string(), false)
            .with_json_payload(&UserRegisteredEventPayload {
                referred: referred_by.is_some(),
                is_bot: false,
            })
            .build(),
    );

    if let Some(original_username) = original_username {
        state.push_event_to_local_user_index(
            user_id,
            UserIndexEvent::UsernameChanged(UsernameChanged {
                user_id,
                username: username.clone(),
            }),
        );
        state.push_event_to_local_user_index(
            user_id,
            UserIndexEvent::OpenChatBotMessageV2(Box::new(OpenChatBotMessageV2 {
                user_id,
                thread_root_message_id: None,
                content: MessageContentInitial::Text(TextContent {
                    text: format!("Unfortunately the username \"{original_username}\" was taken so your username has been changed to \"{username}\".

You can change your username at any time by clicking \"Profile settings\" from the main menu.")
                }),
                mentioned: Vec::new(),
            })),
        );
    }

    state.data.storage_index_user_sync_queue.push(UserConfig {
        user_id: principal,
        byte_limit: 100 * ONE_MB,
    });

    state.data.identity_canister_user_sync_queue.push_back(UserIdentity {
        principal,
        user_id: Some(user_id),
        email,
    });

    crate::jobs::sync_users_to_identity_canister::try_run_now(state);
}
