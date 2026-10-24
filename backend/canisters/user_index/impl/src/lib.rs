use crate::model::bridged_user_tips::{BridgedUserTips, HeldTip, TIP_HOLD_DURATION};
use crate::model::bridged_users::BridgedUsers;
use crate::model::community_event_batch::CommunityEventBatch;
use crate::model::group_event_batch::GroupEventBatch;
use crate::model::group_index_event_batch::GroupIndexEventBatch;
use crate::model::identity_event_batch::IdentityEventBatch;
use crate::model::local_user_index_event_batch::LocalUserIndexEventBatch;
use crate::model::local_user_index_map::LocalUserIndex;
use crate::model::online_users_event_batch::OnlineUsersEventBatch;
use crate::model::premium_items::{PremiumItemMetrics, PremiumItems};
use crate::model::protected_actions::{ProtectedActionMetrics, ProtectedActions};
use crate::model::storage_index_event_batch::StorageIndexEventBatch;
use crate::model::streak_insurance_logs::StreakInsuranceLogs;
use crate::model::user_map::UserMap;
use crate::timer_job_types::{RefundBridgedUserTip, TimerJob};
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use constants::{DAY_IN_MS, MEMO_TIP_CLAIM, MEMO_TIP_REFUND};
use event_store_producer::{EventBuilder, EventStoreClient, EventStoreClientBuilder, EventStoreClientInfo};
use event_store_producer_cdk_runtime::CdkRuntime;
use icrc_ledger_types::icrc1::account::{Account, Subaccount};
use identity_canister::UserIdentity;
use identity_canister::UserIndexEvent as IdentityEvent;
use local_user_index_canister::BridgedUserLinked;
use local_user_index_canister::UserIndexEvent as LocalUserIndexEvent;
use model::authority_reports::{AuthorityReportMetrics, AuthorityReports};
use model::chit_leaderboard::ChitLeaderboard;
use model::external_achievements::{ExternalAchievementMetrics, ExternalAchievements};
use model::local_user_index_map::LocalUserIndexMap;
use model::multi_user_canister_map::{MultiUserCanister, MultiUserCanisterMap};
use model::pending_payments_queue::{PendingPayment, PendingPaymentReason, PendingPaymentsQueue};
use model::reported_messages::{ReportedMessages, ReportingMetrics};
use model::user::SuspensionDetails;
use oc_error_codes::OCErrorCode;
use online_users_canister::{UserDeleted as OnlineUsersUserDeleted, UserIndexEvent as OnlineUsersEvent};
use p256_key_pair::P256KeyPair;
use rand::Rng;
use rand::prelude::StdRng;
use serde::{Deserialize, Serialize};
use stable_memory_map::UserIdsKeyPrefix;
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::time::Duration;
use storage_index_canister::UserIndexEvent as StorageIndexEvent;
use timer_job_queues::{BatchedTimerJobQueue, GroupedTimerJobQueue};
use types::{
    BotInstallationLocation, BridgePlatform, BridgedUserId, BuildVersion, CanisterId, ChannelId, ChatId, ChildCanisterWasms,
    CommunityId, Cycles, DiamondMembershipFees, IdempotentEnvelope, MediaScanConfig, Milliseconds, ModerationReferralConfig,
    OCResult, TimestampMillis, Timestamped, UserId, UserType, icrc1,
};
use user_ids_set::UserIdsSet;
use user_index_canister::ChildCanisterType;
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::env::Environment;
use utils::idempotency_checker::IdempotencyChecker;
use utils::migrated_user_ids::MigratedUserIds;
use utils::time::MonthKey;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod no_inline_anchor;
mod queries;
mod timer_job_types;
mod updates;

const TIME_UNTIL_SUSPENDED_ACCOUNT_IS_DELETED_MILLIS: Milliseconds = DAY_IN_MS * 90; // 90 days

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_openchat_user(&self) -> bool {
        let caller = self.env.caller();
        self.data.users.get(&caller).is_some()
    }

    // A MultiUser canister acts for any of the users it holds
    pub fn is_caller_multi_user_canister(&self) -> bool {
        self.data.multi_user_canisters.contains(&self.env.caller())
    }

    pub fn is_caller_governance_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
    }

    pub fn is_caller_identity_canister(&self) -> bool {
        self.env.caller() == self.data.identity_canister_id
    }

    pub fn is_caller_registry_canister(&self) -> bool {
        self.env.caller() == self.data.registry_canister_id
    }

    pub fn is_caller_local_user_index_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.local_index_map.get(&caller).is_some()
    }

    pub fn is_caller_group_index_canister(&self) -> bool {
        let caller = self.env.caller();
        caller == self.data.group_index_canister_id
    }

    pub fn is_caller_storage_index_canister(&self) -> bool {
        let caller = self.env.caller();
        caller == self.data.storage_index_canister_id
    }

    pub fn is_caller_authority_reporter(&self) -> bool {
        let caller = self.env.caller();
        self.data.authority_reporter == Some(caller)
    }

    pub fn is_caller_translations_canister(&self) -> bool {
        let caller = self.env.caller();
        caller == self.data.translations_canister_id
    }

    // A suspended account holds NO authority while the sanction stands: the role membership
    // survives (it comes back when the suspension lifts) but confers nothing meanwhile. These
    // two are the single choke points for every moderator/operator-gated endpoint and for
    // inspect_message, so the rule cannot be forgotten at a call site.
    pub fn is_caller_platform_moderator(&self) -> bool {
        let caller = self.env.caller();
        self.data
            .users
            .get_by_principal(&caller)
            .is_some_and(|user| self.data.is_platform_moderator_active(&user.user_id))
    }

    pub fn is_caller_platform_operator(&self) -> bool {
        let caller = self.env.caller();
        self.data
            .users
            .get_by_principal(&caller)
            .is_some_and(|user| self.data.is_platform_operator_active(&user.user_id))
    }

    pub fn check_caller_is_bridge_bot(&self, platform: BridgePlatform) -> OCResult {
        let caller = self.env.caller();
        let is_bridge_bot = self
            .data
            .users
            .get_by_principal(&caller)
            .is_some_and(|user| self.data.bridge_bots.get(&platform) == Some(&user.user_id));
        if is_bridge_bot {
            Ok(())
        } else {
            Err(OCErrorCode::InitiatorNotAuthorized.with_message(format!("Only the {platform} bridge bot can do this")))
        }
    }

    pub fn can_caller_upload_wasm_chunks(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller) || self.data.upload_wasm_chunks_whitelist.contains(&caller)
    }

    fn envelope<T>(&mut self, value: T) -> IdempotentEnvelope<T> {
        IdempotentEnvelope {
            created_at: self.env.now(),
            idempotency_id: self.env.rng().next_u64(),
            value,
        }
    }

    // Sends the event to the LocalUserIndex holding the user
    pub fn push_event_to_local_user_index(&mut self, user_id: UserId, event: LocalUserIndexEvent) {
        if let Some(canister_id) = self.local_user_index_of_user(user_id) {
            self.push_event_to_local_user_index_canister(canister_id, event);
        }
    }

    pub fn push_event_to_local_user_index_canister(&mut self, canister_id: CanisterId, event: LocalUserIndexEvent) {
        let event = self.envelope(event);
        self.data.local_user_index_event_sync_queue_v2.push(canister_id, event);
    }

    pub fn push_event_to_identity(&mut self, event: IdentityEvent) {
        let event = self.envelope(event);
        self.data.identity_event_sync_queue.push(event);
    }

    pub fn push_event_to_group(&mut self, group_id: ChatId, event: group_canister::UserIndexEvent) {
        let event = self.envelope(event);
        self.data.group_event_sync_queue.push(group_id.into(), event);
    }

    pub fn push_event_to_community(&mut self, community_id: CommunityId, event: community_canister::UserIndexEvent) {
        let event = self.envelope(event);
        self.data.community_event_sync_queue.push(community_id.into(), event);
    }

    pub fn push_event_to_storage_index(&mut self, event: StorageIndexEvent) {
        let event = self.envelope(event);
        self.data.storage_index_event_sync_queue.push(event);
    }

    // The LocalUserIndex holding the user. A migrated user may still be named by an old id, which no
    // LocalUserIndex is mapped to any more, so they are found by their latest id.
    pub fn local_user_index_of_user(&self, user_id: UserId) -> Option<CanisterId> {
        self.data
            .local_index_map
            .get_index_canister(&self.data.migrated_user_ids.latest(user_id))
    }

    // The LocalUserIndex to send an event about a bot's installation to. A user who installed the bot
    // in their direct chats may since have been migrated to a MultiUser canister held by another
    // LocalUserIndex than the one they installed it through.
    pub fn local_user_index_of_bot_installation(
        &self,
        location: BotInstallationLocation,
        installed_via: CanisterId,
    ) -> CanisterId {
        match location {
            BotInstallationLocation::User(user_id) => self.local_user_index_of_user(user_id.into()).unwrap_or(installed_via),
            BotInstallationLocation::Group(_) | BotInstallationLocation::Community(_) => installed_via,
        }
    }

    // So each LocalUserIndex knows who an account on another platform is linked to, eg. so a group
    // can pay the tips given to the account's relayed messages to them
    pub fn push_bridged_user_link(&mut self, user: BridgedUserId, linked_user_id: Option<UserId>) {
        self.push_event_to_all_local_user_indexes(
            LocalUserIndexEvent::BridgedUserLinked(BridgedUserLinked { user, linked_user_id }),
            None,
        );
    }

    pub fn push_event_to_all_local_user_indexes(&mut self, event: LocalUserIndexEvent, except: Option<CanisterId>) {
        let canister_ids: Vec<_> = self
            .data
            .local_index_map
            .canisters()
            .filter(|c| except != Some(**c))
            .copied()
            .collect();
        for canister_id in canister_ids {
            self.push_event_to_local_user_index_canister(canister_id, event.clone());
        }
    }

    pub fn push_event_to_online_users(&mut self, event: OnlineUsersEvent) {
        let event = self.envelope(event);
        self.data.online_users_event_sync_queue.push(event);
    }

    pub fn get_random_local_user_index_canister(&mut self) -> CanisterId {
        let canisters: Vec<CanisterId> = self.data.local_index_map.canisters().copied().collect();
        let index: usize = self.env.rng().next_u32() as usize % canisters.len();
        canisters[index]
    }

    pub fn queue_payment(&mut self, pending_payment: PendingPayment) {
        self.data.pending_payments_queue.push(pending_payment);
        jobs::make_pending_payments::start_job_if_required(self);
    }

    // A tip on a message relayed from an account which, as the group or community found, no one had
    // linked. It's held for whoever links the account, and refunded if no one has within
    // `TIP_HOLD_DURATION`, or paid on at once if someone has linked it since. (The refund does
    // nothing once the tip has been paid.)
    pub fn receive_bridged_user_tip(&mut self, tip: HeldTip) {
        let account = tip.account;
        let refund_due = tip.timestamp + TIP_HOLD_DURATION;
        let tip_id = self.data.bridged_user_tips.hold(tip);
        let now = self.env.now();
        self.data.timer_jobs.enqueue_job(
            TimerJob::RefundBridgedUserTip(RefundBridgedUserTip { tip_id }),
            refund_due,
            now,
        );
        if let Some(user_id) = self.data.bridged_users.linked_user_id(&account) {
            self.claim_bridged_user_tips(&account, user_id);
        }
    }

    // Pays the tips held for the account to whoever has just linked it, into the wallet they hold
    // their funds in, that of the principal they sign in with
    pub fn claim_bridged_user_tips(&mut self, account: &BridgedUserId, user_id: UserId) {
        let Some(principal) = self.data.users.get_by_user_id(&user_id).map(|user| user.principal) else {
            return;
        };
        for (tip_id, tip) in self.data.bridged_user_tips.take_for(account) {
            self.pay_out_held_tip(
                tip_id,
                tip,
                principal.into(),
                MEMO_TIP_CLAIM,
                PendingPaymentReason::BridgedUserTipClaim,
            );
        }
    }

    // Refunds the tip, unless whoever linked its account has been paid it already
    pub fn refund_bridged_user_tip(&mut self, tip_id: u64) {
        if let Some(tip) = self.data.bridged_user_tips.take(tip_id) {
            let refund_to = tip.refund_to;
            self.pay_out_held_tip(
                tip_id,
                tip,
                refund_to,
                MEMO_TIP_REFUND,
                PendingPaymentReason::BridgedUserTipRefund,
            );
        }
    }

    // Pays the tip out of its account's subaccount, less the ledger's fee. The memo carries the
    // tip's id, so the ledger doesn't take two equal tips paid out at once to be the same transfer.
    fn pay_out_held_tip(
        &mut self,
        tip_id: u64,
        tip: HeldTip,
        to: icrc1::Account,
        memo_prefix: [u8; 8],
        reason: PendingPaymentReason,
    ) {
        // The group or community only holds tips which are more than the fee, and fit
        let Some(amount) = tip
            .amount
            .checked_sub(tip.fee)
            .filter(|amount| *amount > 0)
            .and_then(|amount| u64::try_from(amount).ok())
        else {
            tracing::error!(tip_id, ?tip, "Held tip can't be paid out");
            return;
        };
        let mut memo = [0; 32];
        memo[..8].copy_from_slice(&memo_prefix);
        memo[8..16].copy_from_slice(&tip_id.to_be_bytes());
        self.queue_payment(PendingPayment {
            amount,
            token_symbol: tip.token_symbol,
            ledger: tip.ledger,
            fee: tip.fee,
            timestamp: self.env.now_nanos(),
            recipient_account: to.into(),
            memo,
            reason,
            from_subaccount: Some(tip.account.tips_subaccount()),
        });
    }

    pub fn delete_user(&mut self, user_id: UserId, triggered_by_user: bool) -> bool {
        let now = self.env.now();
        if let Some(user) = self.data.users.delete_user(user_id, now) {
            self.data.local_index_map.remove_user(&user_id);
            self.data.multi_user_canisters.on_user_removed(&user_id);
            self.data.empty_users.remove(&user_id);
            for unlinked in self.data.bridged_users.remove_user(user_id, now) {
                self.push_bridged_user_link(unlinked, None);
            }

            #[derive(Serialize)]
            struct EventPayload {
                triggered_by_user: bool,
            }

            self.data.event_store_client.push(
                EventBuilder::new("user_deleted", now)
                    .with_user(user_id.to_string(), true)
                    .with_source(self.env.canister_id().to_string(), false)
                    .with_json_payload(&EventPayload { triggered_by_user })
                    .build(),
            );

            self.data.deleted_users.push(DeletedUser {
                user_id,
                triggered_by_user,
                timestamp: now,
            });

            self.push_event_to_online_users(OnlineUsersEvent::UserDeleted(OnlineUsersUserDeleted {
                user_principal: user.principal,
            }));

            self.push_event_to_storage_index(StorageIndexEvent::RemoveUser(user.principal));
            true
        } else {
            false
        }
    }

    pub fn user_metrics(&self, user_id: UserId) -> Option<UserMetrics> {
        self.data.users.get_by_user_id(&user_id).map(|user| {
            let now = self.env.now();
            UserMetrics {
                now,
                username: user.username.clone(),
                date_created: user.date_created,
                date_updated: user.date_updated,
                is_bot: user.user_type.is_bot(),
                suspension_details: user.suspension_details.clone(),
                moderation_flags_enabled: user.moderation_flags_enabled,
                chit_balance: user
                    .chit_per_month
                    .get(&MonthKey::from_timestamp(now))
                    .copied()
                    .unwrap_or_default(),
                max_stream: user.max_streak,
                streak: user.streak(now),
                streak_ends: user.streak_ends,
                chit_updated: user.chit_updated,
            }
        })
    }

    pub fn metrics(&self) -> Metrics {
        let now = self.env.now();

        let canister_upgrades_metrics = self.data.canisters_requiring_upgrade.metrics();
        let event_store_client_info = self.data.event_store_client.info();
        let event_relay_canister_id = event_store_client_info.event_store_canister_id;

        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now,
            cycles_balance: self.env.cycles_balance(),
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: git_commit_id::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            users_created: self.data.users.len() as u64,
            diamond_members: DiamondMembershipMetrics {
                users: self.data.users.diamond_metrics(now),
                payments: self.data.diamond_membership_payment_metrics.clone(),
            },
            canister_upgrades_completed: canister_upgrades_metrics.completed,
            canister_upgrades_failed: canister_upgrades_metrics.failed,
            canister_upgrades_pending: canister_upgrades_metrics.pending,
            canister_upgrades_in_progress: canister_upgrades_metrics.in_progress,
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            local_user_index_wasm_version: self
                .data
                .child_canister_wasms
                .get(ChildCanisterType::LocalUserIndex)
                .wasm
                .version,
            multi_user_wasm_version: self.data.child_canister_wasms.get(ChildCanisterType::MultiUser).wasm.version,
            max_concurrent_canister_upgrades: self.data.max_concurrent_canister_upgrades,
            platform_moderators: self.data.platform_moderators.len() as u8,
            platform_operators: self.data.platform_operators.len() as u8,
            user_index_events_queue_length: self.data.local_user_index_event_sync_queue_v2.len(),
            local_user_indexes: self.data.local_index_map.iter().map(|(c, i)| (*c, i.clone())).collect(),
            multi_user_canisters: self.data.multi_user_canisters.iter().map(|(c, m)| (*c, m.clone())).collect(),
            migrated_user_ids: self.data.migrated_user_ids.len(),
            call_push_enabled: self.data.call_push_enabled,
            bridged_users: self.data.bridged_users.len(),
            bridged_user_tips_held: self.data.bridged_user_tips.len(),
            platform_moderators_group: self.data.platform_moderators_group,
            nns_8_year_neuron: self.data.nns_8_year_neuron.clone(),
            event_store_client_info,
            pending_payments: self.data.pending_payments_queue.len(),
            payments_awaiting_retry: self
                .data
                .timer_jobs
                .iter()
                // A job which has already run leaves an empty entry behind
                .filter(|(_, wrapper)| matches!(wrapper.borrow().as_ref(), Some(TimerJob::RetryPayment(_))))
                .count() as u32,
            parked_payments: self.data.pending_payments_queue.parked_len() as u32,
            pending_users_to_sync_to_storage_index: self.data.storage_index_event_sync_queue.len(),
            queued_group_events: self.data.group_event_sync_queue.len(),
            queued_community_events: self.data.community_event_sync_queue.len(),
            reporting_metrics: self.data.reported_messages.metrics(),
            authority_report_metrics: self.data.authority_reports.metrics(),
            protected_action_metrics: self.data.protected_actions.metrics(),
            vault_reviewers: self.data.vault_reviewers.len() as u32,
            openai_api_key_set: self.data.openai_api_key.is_some(),
            alchemy_api_key_set: self.data.alchemy_api_key.is_some(),
            internal_moderation_channel_set: self.data.internal_moderation_channel.is_some(),
            // Presence and size only: the metrics endpoint is public and the per-category
            // thresholds must not be readable by people tuning content to sit under them.
            // Operators read the full config via the guarded moderation_config query.
            moderation_referral_config_set: self.data.moderation_referral_config.is_some(),
            media_scanning_enabled: self.data.media_scan_config.enabled,
            media_scanners: self.data.media_scan_config.scanners.len() as u32,
            moderation_referral_categories: self
                .data
                .moderation_referral_config
                .as_ref()
                .map_or(0, |c| c.categories.len() as u32),
            oc_public_key: self.data.oc_key_pair.public_key_pem().to_string(),
            empty_users: self.data.empty_users.len(),
            deleted_users: self.data.deleted_users.len(),
            blocked_user_pairs: self.data.blocked_users.len() as u64,
            july_airdrop_period: self.build_stats_for_cohort(1719792000000, 1723021200000),
            august_airdrop_period: self.build_stats_for_cohort(1723021200000, 1725181200000),
            streak_badges: self.data.users.streak_badge_metrics(now),
            survey_messages_sent: self.data.survey_messages_sent,
            external_achievements: self.data.external_achievements.metrics(),
            upload_wasm_chunks_whitelist: self.data.upload_wasm_chunks_whitelist.clone(),
            wasm_chunks_uploaded: self
                .data
                .child_canister_wasms
                .chunk_hashes()
                .into_iter()
                .map(|(c, h)| (*c, hex::encode(h)))
                .collect(),
            stable_memory_sizes: memory::memory_sizes(),
            streak_insurance_metrics: self.data.streak_insurance_logs.metrics(),
            premium_item_metrics: self.data.premium_items.metrics(),
            blocked_username_patterns: self.data.blocked_username_patterns.clone(),
            canister_ids: CanisterIds {
                group_index: self.data.group_index_canister_id,
                notifications_index: self.data.notifications_index_canister_id,
                identity: self.data.identity_canister_id,
                proposals_bot: self.data.proposals_bot_canister_id,
                online_users: self.data.online_users_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
                storage_index: self.data.storage_index_canister_id,
                escrow: self.data.escrow_canister_id,
                translations: self.data.translations_canister_id,
                event_relay: event_relay_canister_id,
                registry: self.data.registry_canister_id,
                internet_identity: self.data.internet_identity_canister_id,
                website: self.data.website_canister_id,
                daily_puzzle: self.data.daily_puzzle_canister_id,
            },
        }
    }

    fn build_stats_for_cohort(&self, airdrop_from: TimestampMillis, airdrop_to: TimestampMillis) -> AirdropStats {
        let mut stats = AirdropStats::default();

        for user in self.data.users.iter() {
            let diamond = user.diamond_membership_details.was_active(airdrop_from)
                || user.diamond_membership_details.was_active(airdrop_to);

            let lifetime_diamond = user.diamond_membership_details.is_lifetime_diamond_member();

            if diamond {
                stats.diamond += 1;
            }

            if lifetime_diamond {
                stats.lifetime_diamond += 1;
            }

            if user.unique_person_proof.is_some() {
                stats.proved_uniqueness += 1;
            }

            if (user.unique_person_proof.is_some() && diamond) || lifetime_diamond {
                stats.qualify_for_airdrop += 1;
            }
        }

        stats
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub users: UserMap,
    pub governance_principals: HashSet<Principal>,
    pub child_canister_wasms: ChildCanisterWasms<ChildCanisterType>,
    pub group_index_canister_id: CanisterId,
    pub notifications_index_canister_id: CanisterId,
    pub identity_canister_id: CanisterId,
    pub proposals_bot_canister_id: CanisterId,
    pub online_users_canister_id: CanisterId,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub total_cycles_spent_on_canisters: Cycles,
    pub cycles_dispenser_canister_id: CanisterId,
    pub storage_index_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub translations_canister_id: CanisterId,
    pub registry_canister_id: CanisterId,
    pub event_store_client: EventStoreClient<CdkRuntime>,
    pub storage_index_event_sync_queue: BatchedTimerJobQueue<StorageIndexEventBatch>,
    pub group_event_sync_queue: GroupedTimerJobQueue<GroupEventBatch>,
    pub community_event_sync_queue: GroupedTimerJobQueue<CommunityEventBatch>,
    pub local_user_index_event_sync_queue_v2: GroupedTimerJobQueue<LocalUserIndexEventBatch>,
    pub group_index_event_sync_queue: BatchedTimerJobQueue<GroupIndexEventBatch>,
    pub online_users_event_sync_queue: BatchedTimerJobQueue<OnlineUsersEventBatch>,
    pub pending_payments_queue: PendingPaymentsQueue,
    pub platform_moderators: HashSet<UserId>,
    pub platform_operators: HashSet<UserId>,
    pub test_mode: bool,
    pub max_concurrent_canister_upgrades: usize,
    pub diamond_membership_payment_metrics: DiamondMembershipPaymentMetrics,
    pub local_index_map: LocalUserIndexMap,
    pub timer_jobs: TimerJobs<TimerJob>,
    pub neuron_controllers_for_initial_airdrop: HashMap<UserId, Principal>,
    pub nns_governance_canister_id: CanisterId,
    pub internet_identity_canister_id: CanisterId,
    pub website_canister_id: CanisterId,
    pub platform_moderators_group: Option<ChatId>,
    pub reported_messages: ReportedMessages,
    #[serde(default)]
    pub authority_reports: AuthorityReports,
    #[serde(default)]
    pub vault_reviewers: HashSet<UserId>,
    // The principal of the off-chain NCA reporting service; set only via the dual-authorized
    // set_authority_reporter protected action
    #[serde(default)]
    pub authority_reporter: Option<Principal>,
    #[serde(default)]
    pub protected_actions: ProtectedActions,
    pub nns_8_year_neuron: Option<NnsNeuron>,
    pub rng_seed: [u8; 32],
    pub diamond_membership_fees: DiamondMembershipFees,
    pub video_call_operators: Vec<Principal>,
    pub oc_key_pair: P256KeyPair,
    pub empty_users: HashSet<UserId>,
    pub chit_leaderboard: ChitLeaderboard,
    pub deleted_users: Vec<DeletedUser>,
    pub identity_event_sync_queue: BatchedTimerJobQueue<IdentityEventBatch>,
    pub survey_messages_sent: usize,
    pub external_achievements: ExternalAchievements,
    pub upload_wasm_chunks_whitelist: Vec<Principal>,
    pub streak_insurance_logs: StreakInsuranceLogs,
    pub idempotency_checker: IdempotencyChecker,
    pub blocked_users: UserIdsSet,
    pub premium_items: PremiumItems,
    #[serde(default)]
    pub blocked_username_patterns: Vec<String>,
    pub openai_api_key: Option<String>,
    #[serde(default)]
    pub moderation_referral_config: Option<ModerationReferralConfig>,
    #[serde(default)]
    pub media_scan_config: MediaScanConfig,
    #[serde(default)]
    pub internal_moderation_channel: Option<(CommunityId, ChannelId)>,
    // Per-(report, uploader) notice throttle for blocked re-post attempts:
    // (last posted, suppressed count)
    #[serde(default)]
    pub blocked_attempt_notice_throttle: HashMap<(u64, Principal), (TimestampMillis, u32)>,
    // Each MultiUser canister, along with when it was created, the LocalUserIndex which controls it
    // and how many users it holds. Stored under a new name since the previous shape, a map of
    // canister id -> LocalUserIndex, is still held under the old one
    #[serde(rename = "multi_user_canisters_v2", default)]
    pub multi_user_canisters: MultiUserCanisterMap,
    // The native call push kill switch (#9456). Set by a platform operator and fanned out to the
    // LocalUserIndexes, including any added later
    #[serde(default)]
    pub call_push_enabled: bool,
    // Set by proposal and fanned out to the LocalUserIndexes, including any added later
    #[serde(default)]
    pub daily_puzzle_canister_id: Option<CanisterId>,
    // The bot that bridges each platform, eg. Discord. Set by a platform operator and fanned out to
    // the LocalUserIndexes, including any added later
    #[serde(default)]
    pub bridge_bots: BTreeMap<BridgePlatform, UserId>,
    // The latest profile of each account a bridge bot has relayed a message from
    #[serde(default)]
    pub bridged_users: BridgedUsers,
    // The tips on messages relayed from accounts no one had linked, held for whoever links them
    #[serde(default)]
    pub bridged_user_tips: BridgedUserTips,
    // The old id -> the new id of each user migrated to a MultiUser canister. Fanned out to the
    // LocalUserIndexes, including any added later
    #[serde(default)]
    pub migrated_user_ids: MigratedUserIds,
    // The key the MultiUser canisters use to call Alchemy's Solana RPC. Set by a platform operator and
    // fanned out to the LocalUserIndexes, including any added later, which pass it on to their
    // MultiUser canisters
    #[serde(default)]
    pub alchemy_api_key: Option<String>,
}

impl Data {
    // Role membership masked by suspension: every surface which reports or syncs a user's
    // moderator/operator status must go through these so a suspended account never shows (or
    // is seeded elsewhere) as holding authority it cannot currently exercise
    pub fn is_platform_moderator_active(&self, user_id: &UserId) -> bool {
        self.platform_moderators.contains(user_id) && self.users.is_user_suspended(user_id) == Some(false)
    }

    pub fn is_platform_operator_active(&self, user_id: &UserId) -> bool {
        self.platform_operators.contains(user_id) && self.users.is_user_suspended(user_id) == Some(false)
    }

    #[expect(clippy::too_many_arguments)]
    pub fn new(
        governance_principals: Vec<Principal>,
        group_index_canister_id: CanisterId,
        notifications_index_canister_id: CanisterId,
        identity_canister_id: CanisterId,
        proposals_bot_canister_id: CanisterId,
        online_users_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        storage_index_canister_id: CanisterId,
        escrow_canister_id: CanisterId,
        event_relay_canister_id: CanisterId,
        registry_canister_id: CanisterId,
        nns_governance_canister_id: CanisterId,
        internet_identity_canister_id: CanisterId,
        translations_canister_id: CanisterId,
        website_canister_id: CanisterId,
        video_call_operators: Vec<Principal>,
        oc_secret_key_der: Vec<u8>,
        test_mode: bool,
        now: TimestampMillis,
    ) -> Self {
        let mut data = Data {
            users: UserMap::default(),
            governance_principals: governance_principals.into_iter().collect(),
            child_canister_wasms: ChildCanisterWasms::default(),
            group_index_canister_id,
            notifications_index_canister_id,
            identity_canister_id,
            proposals_bot_canister_id,
            online_users_canister_id,
            cycles_dispenser_canister_id,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            total_cycles_spent_on_canisters: 0,
            storage_index_canister_id,
            escrow_canister_id,
            translations_canister_id,
            registry_canister_id,
            event_store_client: EventStoreClientBuilder::new(event_relay_canister_id, CdkRuntime::default())
                .with_flush_delay(Duration::from_secs(60))
                .build(),
            storage_index_event_sync_queue: BatchedTimerJobQueue::new(storage_index_canister_id, false),
            group_event_sync_queue: GroupedTimerJobQueue::new(10, false),
            community_event_sync_queue: GroupedTimerJobQueue::new(10, false),
            local_user_index_event_sync_queue_v2: GroupedTimerJobQueue::new(10, false),
            group_index_event_sync_queue: BatchedTimerJobQueue::new(group_index_canister_id, false),
            online_users_event_sync_queue: BatchedTimerJobQueue::new(online_users_canister_id, false),
            pending_payments_queue: PendingPaymentsQueue::default(),
            platform_moderators: HashSet::new(),
            platform_operators: HashSet::new(),
            test_mode,
            max_concurrent_canister_upgrades: 2,
            diamond_membership_payment_metrics: DiamondMembershipPaymentMetrics::default(),
            local_index_map: LocalUserIndexMap::default(),
            timer_jobs: TimerJobs::default(),
            neuron_controllers_for_initial_airdrop: HashMap::new(),
            nns_governance_canister_id,
            internet_identity_canister_id,
            website_canister_id,
            platform_moderators_group: None,
            nns_8_year_neuron: None,
            reported_messages: ReportedMessages::default(),
            authority_reports: AuthorityReports::default(),
            vault_reviewers: HashSet::new(),
            authority_reporter: None,
            protected_actions: ProtectedActions::default(),
            rng_seed: [0; 32],
            diamond_membership_fees: DiamondMembershipFees::default(),
            video_call_operators,
            oc_key_pair: P256KeyPair::from_secret_key_der(oc_secret_key_der).unwrap(),
            empty_users: HashSet::new(),
            chit_leaderboard: ChitLeaderboard::new(now),
            deleted_users: Vec::new(),
            identity_event_sync_queue: BatchedTimerJobQueue::new(identity_canister_id, false),
            survey_messages_sent: 0,
            external_achievements: ExternalAchievements::default(),
            upload_wasm_chunks_whitelist: Vec::new(),
            streak_insurance_logs: StreakInsuranceLogs::default(),
            idempotency_checker: IdempotencyChecker::default(),
            blocked_users: UserIdsSet::new(UserIdsKeyPrefix::new_for_blocked_users()),
            premium_items: PremiumItems::default(),
            blocked_username_patterns: Vec::new(),
            openai_api_key: None,
            moderation_referral_config: None,
            media_scan_config: MediaScanConfig::default(),
            internal_moderation_channel: None,
            blocked_attempt_notice_throttle: HashMap::new(),
            multi_user_canisters: MultiUserCanisterMap::default(),
            call_push_enabled: false,
            daily_puzzle_canister_id: None,
            bridge_bots: BTreeMap::new(),
            bridged_users: BridgedUsers::default(),
            bridged_user_tips: BridgedUserTips::default(),
            migrated_user_ids: MigratedUserIds::default(),
            alchemy_api_key: None,
        };

        // Register the ProposalsBot
        data.users.register(
            proposals_bot_canister_id,
            proposals_bot_canister_id.into(),
            "ProposalsBot".to_string(),
            None,
            now,
            None,
            UserType::OcControlledBot,
            None,
        );

        data
    }

    pub fn nns_neuron_account(&self) -> Option<Account> {
        self.nns_8_year_neuron.as_ref().map(|n| Account {
            owner: self.nns_governance_canister_id,
            subaccount: Some(n.subaccount),
        })
    }

    pub fn chit_bands(&self, size: u32, year: u32, month: u8) -> BTreeMap<u32, u32> {
        let mut bands = BTreeMap::new();
        let month_key = MonthKey::new(year, month);

        for chit in self
            .users
            .iter()
            .map(|u| u.chit_per_month.get(&month_key).copied().unwrap_or_default())
            .filter(|c| *c > 0)
            .map(|c| c as u32)
        {
            let band = (chit / size) * size;
            bands.entry(band).and_modify(|e| *e += 1).or_insert(1);
        }

        bands
    }
}

#[cfg(test)]
impl Default for Data {
    fn default() -> Data {
        Data {
            users: UserMap::default(),
            governance_principals: HashSet::new(),
            child_canister_wasms: ChildCanisterWasms::default(),
            group_index_canister_id: Principal::anonymous(),
            notifications_index_canister_id: Principal::anonymous(),
            identity_canister_id: Principal::anonymous(),
            proposals_bot_canister_id: Principal::anonymous(),
            online_users_canister_id: Principal::anonymous(),
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            cycles_dispenser_canister_id: Principal::anonymous(),
            total_cycles_spent_on_canisters: 0,
            storage_index_canister_id: Principal::anonymous(),
            escrow_canister_id: Principal::anonymous(),
            translations_canister_id: Principal::anonymous(),
            registry_canister_id: Principal::anonymous(),
            event_store_client: EventStoreClientBuilder::new(Principal::anonymous(), CdkRuntime::default()).build(),
            storage_index_event_sync_queue: BatchedTimerJobQueue::new(Principal::anonymous(), false),
            group_event_sync_queue: GroupedTimerJobQueue::new(10, false),
            community_event_sync_queue: GroupedTimerJobQueue::new(10, false),
            local_user_index_event_sync_queue_v2: GroupedTimerJobQueue::new(10, false),
            group_index_event_sync_queue: BatchedTimerJobQueue::new(Principal::anonymous(), false),
            online_users_event_sync_queue: BatchedTimerJobQueue::new(Principal::anonymous(), false),
            pending_payments_queue: PendingPaymentsQueue::default(),
            platform_moderators: HashSet::new(),
            platform_operators: HashSet::new(),
            test_mode: true,
            max_concurrent_canister_upgrades: 2,
            diamond_membership_payment_metrics: DiamondMembershipPaymentMetrics::default(),
            local_index_map: LocalUserIndexMap::default(),
            timer_jobs: TimerJobs::default(),
            neuron_controllers_for_initial_airdrop: HashMap::new(),
            nns_governance_canister_id: Principal::anonymous(),
            internet_identity_canister_id: Principal::anonymous(),
            website_canister_id: Principal::anonymous(),
            platform_moderators_group: None,
            reported_messages: ReportedMessages::default(),
            authority_reports: AuthorityReports::default(),
            vault_reviewers: HashSet::new(),
            authority_reporter: None,
            protected_actions: ProtectedActions::default(),
            nns_8_year_neuron: None,
            rng_seed: [0; 32],
            diamond_membership_fees: DiamondMembershipFees::default(),
            video_call_operators: Vec::default(),
            oc_key_pair: P256KeyPair::new(&mut rand::rng()),
            empty_users: HashSet::new(),
            chit_leaderboard: ChitLeaderboard::new(0),
            deleted_users: Vec::new(),
            identity_event_sync_queue: BatchedTimerJobQueue::new(Principal::anonymous(), false),
            survey_messages_sent: 0,
            external_achievements: ExternalAchievements::default(),
            upload_wasm_chunks_whitelist: Vec::new(),
            streak_insurance_logs: StreakInsuranceLogs::default(),
            idempotency_checker: IdempotencyChecker::default(),
            blocked_users: UserIdsSet::new(UserIdsKeyPrefix::new_for_blocked_users()),
            premium_items: PremiumItems::default(),
            blocked_username_patterns: Vec::new(),
            openai_api_key: None,
            moderation_referral_config: None,
            media_scan_config: MediaScanConfig::default(),
            internal_moderation_channel: None,
            blocked_attempt_notice_throttle: HashMap::new(),
            multi_user_canisters: MultiUserCanisterMap::default(),
            call_push_enabled: false,
            daily_puzzle_canister_id: None,
            bridge_bots: BTreeMap::new(),
            bridged_users: BridgedUsers::default(),
            bridged_user_tips: BridgedUserTips::default(),
            migrated_user_ids: MigratedUserIds::default(),
            alchemy_api_key: None,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub liquid_cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub total_cycles_spent_on_canisters: Cycles,
    pub users_created: u64,
    pub diamond_members: DiamondMembershipMetrics,
    pub canister_upgrades_completed: u64,
    pub canister_upgrades_failed: Vec<FailedUpgradeCount>,
    pub canister_upgrades_pending: u64,
    pub canister_upgrades_in_progress: u64,
    pub governance_principals: Vec<Principal>,
    pub local_user_index_wasm_version: BuildVersion,
    pub multi_user_wasm_version: BuildVersion,
    pub max_concurrent_canister_upgrades: usize,
    pub platform_moderators: u8,
    pub platform_operators: u8,
    pub user_index_events_queue_length: usize,
    pub local_user_indexes: Vec<(CanisterId, LocalUserIndex)>,
    pub multi_user_canisters: Vec<(CanisterId, MultiUserCanister)>,
    pub migrated_user_ids: usize,
    pub call_push_enabled: bool,
    pub bridged_users: usize,
    pub bridged_user_tips_held: usize,
    pub platform_moderators_group: Option<ChatId>,
    pub nns_8_year_neuron: Option<NnsNeuron>,
    pub event_store_client_info: EventStoreClientInfo,
    pub pending_payments: usize,
    pub payments_awaiting_retry: u32,
    pub parked_payments: u32,
    pub pending_users_to_sync_to_storage_index: usize,
    pub queued_group_events: usize,
    pub queued_community_events: usize,
    pub reporting_metrics: ReportingMetrics,
    pub authority_report_metrics: AuthorityReportMetrics,
    pub vault_reviewers: u32,
    pub protected_action_metrics: ProtectedActionMetrics,
    pub openai_api_key_set: bool,
    pub alchemy_api_key_set: bool,
    pub internal_moderation_channel_set: bool,
    pub moderation_referral_config_set: bool,
    pub moderation_referral_categories: u32,
    pub media_scanning_enabled: bool,
    pub media_scanners: u32,
    pub oc_public_key: String,
    pub empty_users: usize,
    pub deleted_users: usize,
    pub blocked_user_pairs: u64,
    pub july_airdrop_period: AirdropStats,
    pub august_airdrop_period: AirdropStats,
    pub streak_badges: BTreeMap<u16, u32>,
    pub survey_messages_sent: usize,
    pub external_achievements: Vec<ExternalAchievementMetrics>,
    pub upload_wasm_chunks_whitelist: Vec<Principal>,
    pub wasm_chunks_uploaded: Vec<(ChildCanisterType, String)>,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub streak_insurance_metrics: StreakInsuranceMetrics,
    pub premium_item_metrics: PremiumItemMetrics,
    pub blocked_username_patterns: Vec<String>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct UserMetrics {
    pub now: TimestampMillis,
    pub username: String,
    pub date_created: TimestampMillis,
    pub date_updated: TimestampMillis,
    pub is_bot: bool,
    pub suspension_details: Option<SuspensionDetails>,
    pub moderation_flags_enabled: u32,
    pub chit_balance: i32,
    pub chit_updated: TimestampMillis,
    pub max_stream: u16,
    pub streak: u16,
    pub streak_ends: TimestampMillis,
}

#[derive(Serialize, Debug, Default)]
pub struct AirdropStats {
    pub diamond: u32,
    pub lifetime_diamond: u32,
    pub proved_uniqueness: u32,
    pub qualify_for_airdrop: u32,
}

#[derive(Serialize, Debug, Default)]
pub struct DiamondMembershipMetrics {
    pub users: DiamondMembershipUserMetrics,
    pub payments: DiamondMembershipPaymentMetrics,
}

#[derive(Serialize, Debug, Default)]
pub struct DiamondMembershipUserMetrics {
    pub total: u64,
    pub lifetime: u64,
    pub recurring: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct DiamondMembershipPaymentMetrics {
    pub amount_raised: Vec<(String, u128)>,
    pub manual_payments_taken: u64,
    pub recurring_payments_taken: u64,
    pub recurring_payments_failed_due_to_insufficient_funds: u64,
    #[serde(default)]
    pub recurring_payments_failed_due_to_insufficient_allowance: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NnsNeuron {
    pub neuron_id: u64,
    pub subaccount: Subaccount,
}

#[derive(Serialize)]
struct UserRegisteredEventPayload {
    referred: bool,
    is_bot: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DeletedUser {
    pub user_id: UserId,
    pub triggered_by_user: bool,
    pub timestamp: TimestampMillis,
}

#[derive(Serialize, Debug, Default)]
pub struct StreakInsuranceMetrics {
    payments: u32,
    payments_unique_users: u32,
    claims: u32,
    claims_unique_users: u32,
    total_paid: u128,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub group_index: CanisterId,
    pub notifications_index: CanisterId,
    pub identity: CanisterId,
    pub proposals_bot: CanisterId,
    pub online_users: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub storage_index: CanisterId,
    pub escrow: CanisterId,
    pub translations: CanisterId,
    pub event_relay: CanisterId,
    pub registry: CanisterId,
    pub internet_identity: CanisterId,
    pub website: CanisterId,
    pub daily_puzzle: Option<CanisterId>,
}

// Pushes events to a LocalUserIndex while the rest of the state is borrowed
pub struct LocalUserIndexEventPusher<'a> {
    pub now: TimestampMillis,
    pub rng: &'a mut StdRng,
    pub queue: &'a mut GroupedTimerJobQueue<LocalUserIndexEventBatch>,
}

impl LocalUserIndexEventPusher<'_> {
    pub fn push(&mut self, canister_id: CanisterId, event: LocalUserIndexEvent) {
        self.queue.push(
            canister_id,
            IdempotentEnvelope {
                created_at: self.now,
                idempotency_id: self.rng.next_u64(),
                value: event,
            },
        )
    }
}
