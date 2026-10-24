use crate::guards::caller_is_local_user_index_canister;
use crate::model::bridged_user_tips::HeldTip;
use crate::updates::c2c_csam_detected::c2c_csam_detected_impl;
use crate::updates::c2c_moderation_referral::c2c_moderation_referral_impl;
use crate::{IdentityEvent, StorageIndexEvent};
use crate::{RuntimeState, UserIdentity, UserRegisteredEventPayload, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use constants::ONE_MB;
use event_store_producer::EventBuilder;
use group_index_canister::UserIndexEvent as GroupIndexEvent;
use local_user_index_canister::{
    ChitBalance, OpenChatBotMessageV2, UserIndexEvent, UserJoinedCommunityOrChannel, UserJoinedGroup, UserRegistered,
    UsernameChanged,
};
use rand::Rng;
use stable_memory_map::StableMemoryMap;
use std::cell::LazyCell;
use storage_index_canister::UserConfig;
use tracing::info;
use types::{CanisterId, IdempotentEnvelope, MessageContentInitial, TextContent, TimestampMillis, UserId, UserType};
use user_index_canister::LocalUserIndexEvent;
use user_index_canister::c2c_local_index::*;

#[update(guard = "caller_is_local_user_index_canister", msgpack = true)]
#[trace]
fn c2c_local_index(args: Args) -> Response {
    mutate_state(|state| c2c_local_index_impl(args, state))
}

fn c2c_local_index_impl(args: Args, state: &mut RuntimeState) -> Response {
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

fn handle_event<F: FnOnce() -> TimestampMillis>(
    event: LocalUserIndexEvent,
    event_timestamp: TimestampMillis,
    caller: Principal,
    now: &LazyCell<TimestampMillis, F>,
    state: &mut RuntimeState,
) {
    match event {
        LocalUserIndexEvent::CsamDetected(ev) => c2c_csam_detected_impl(*ev, state),
        LocalUserIndexEvent::ModerationReferral(ev) => c2c_moderation_referral_impl(*ev, state),
        LocalUserIndexEvent::BridgedUserUpdated(user) => {
            state.data.bridged_users.update(*user, **now);
        }
        LocalUserIndexEvent::BridgedUserTipped(ev) => {
            let ev = *ev;
            state.data.bridged_user_tips.hold(HeldTip {
                account: ev.account,
                chat: ev.chat,
                thread_root_message_index: ev.thread_root_message_index,
                message_id: ev.message_id,
                tipper: ev.tipper,
                refund_to: ev.refund_to,
                ledger: ev.ledger,
                token_symbol: ev.token_symbol,
                amount: ev.amount,
                fee: ev.fee,
                decimals: ev.decimals,
                timestamp: **now,
            });
        }
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
        LocalUserIndexEvent::UserSetAvatar(ev) => {
            let (user_id, avatar_id) = *ev;
            state.data.users.set_avatar_id(&user_id, avatar_id, **now);
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

    state.push_event_to_storage_index(StorageIndexEvent::AddOrUpdateUser(UserConfig {
        user_id: principal,
        byte_limit: 100 * ONE_MB,
    }));

    state.push_event_to_identity(IdentityEvent::SetUserIdentity(UserIdentity {
        principal,
        user_id: Some(user_id),
        email,
    }));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use crate::model::user::User;
    use utils::env::test::TestEnv;

    fn canister_id(n: u8) -> CanisterId {
        Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, n, 1, 1])
    }

    // A user in each of two MultiUser canisters
    fn setup() -> (RuntimeState, UserId, UserId) {
        let user = UserId::new_indexed(canister_id(2), 1);
        let other_user = UserId::new_indexed(canister_id(3), 1);

        let mut data = Data::default();
        for (i, user_id) in [user, other_user].into_iter().enumerate() {
            data.users.add_test_user(User {
                principal: Principal::from_slice(&[i as u8 + 10; 29]),
                user_id,
                username: format!("user{i}"),
                ..Default::default()
            });
        }
        let state = RuntimeState::new(Box::new(TestEnv::default()), data);
        (state, user, other_user)
    }

    fn avatar_id(state: &RuntimeState, user_id: UserId) -> Option<u128> {
        state.data.users.get_by_user_id(&user_id).unwrap().avatar_id
    }

    // The LocalUserIndex only forwards events from the users each MultiUser canister holds, so the
    // handler can trust the user id it names
    #[test]
    fn user_set_avatar_updates_the_named_user() {
        let (mut state, user, other_user) = setup();
        let local_user_index = canister_id(1);
        let now = LazyCell::new(|| 1000);

        handle_event(
            LocalUserIndexEvent::UserSetAvatar(Box::new((user, Some(5)))),
            1000,
            local_user_index,
            &now,
            &mut state,
        );

        assert_eq!(avatar_id(&state, user), Some(5));
        assert_eq!(avatar_id(&state, other_user), None);
    }

    // A tip for an account no one has linked is held as the group or community described it, as of
    // when it arrived
    #[test]
    fn bridged_user_tipped_holds_the_tip() {
        let (mut state, tipper, _) = setup();
        let account = types::BridgedUserId::Telegram(123456789);
        let chat = types::Chat::Group(canister_id(4).into());
        let refund_to: types::icrc1::Account = Principal::from_slice(&[7; 29]).into();
        let ledger = canister_id(5);
        let now = LazyCell::new(|| 2000);

        handle_event(
            LocalUserIndexEvent::BridgedUserTipped(Box::new(user_index_canister::BridgedUserTipped {
                chat,
                thread_root_message_index: Some(3.into()),
                message_id: 42u64.into(),
                account,
                tipper,
                refund_to,
                ledger,
                token_symbol: "CHAT".to_string(),
                amount: 1_000_000,
                fee: 100_000,
                decimals: 8,
            })),
            1000,
            canister_id(1),
            &now,
            &mut state,
        );

        assert_eq!(state.data.bridged_user_tips.len(), 1);
        let tip = state.data.bridged_user_tips.get(0).unwrap();
        assert_eq!(tip.account, account);
        assert_eq!(tip.chat, chat);
        assert_eq!(tip.thread_root_message_index, Some(3.into()));
        assert_eq!(tip.message_id, 42u64.into());
        assert_eq!(tip.tipper, tipper);
        assert_eq!(tip.refund_to.owner, refund_to.owner);
        assert_eq!(tip.refund_to.subaccount, refund_to.subaccount);
        assert_eq!(tip.ledger, ledger);
        assert_eq!(tip.token_symbol, "CHAT");
        assert_eq!((tip.amount, tip.fee, tip.decimals), (1_000_000, 100_000, 8));
        assert_eq!(tip.timestamp, 2000);
    }
}
