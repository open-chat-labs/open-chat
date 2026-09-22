use crate::model::legacy_user_canister_event_batch::LegacyUserCanisterEventBatch;
use crate::model::local_user_index_event_batch::LocalUserIndexEventBatch;
use crate::model::p2p_swaps::P2PSwaps;
use crate::model::premium_items::PremiumItems;
use crate::model::token_swaps::TokenSwaps;
use crate::model::user_canister_event_batch::UserCanisterEventBatch;
use crate::{Data, TimerJob, new_user_canister_events_by_canister};
use candid::Principal;
use canister_timer_jobs::TimerJobs;
use direct_chat::DirectChats;
use fire_and_forget_handler::FireAndForgetHandler;
use installed_bots::InstalledBots;
use serde::Deserialize;
use stable_memory_map::BaseKeyPrefix;
use std::collections::HashSet;
use timer_job_queues::{BatchedTimerJobQueue, GroupedTimerJobQueue};
use types::{Achievement, CanisterId, TimestampMillis, Timestamped, UniquePersonProof, UserId};
use user_canister::WalletConfig;
use user_state::{
    BlockedUsers, ChitEvents, Communities, Contacts, FavouriteChats, GameChitKeys, GroupChats, HotGroupExclusions,
    MessageActivityEvents, PinNumber, ProfileDocument, Referrals, SavedCryptoAccounts, Streak, User,
};
use utils::idempotency_checker::IdempotencyChecker;

// `Data` as it was serialized before the user's fields were split out into the shared `User`, which
// `post_upgrade` falls back to when the stable memory holds that layout
// TODO: Remove this once every user canister has been upgraded past it
#[derive(Deserialize)]
pub struct DataPrevious {
    pub owner: Principal,
    pub direct_chats: DirectChats,
    pub group_chats: GroupChats,
    pub communities: Communities,
    pub favourite_chats: FavouriteChats,
    pub blocked_users: BlockedUsers,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub identity_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub avatar: ProfileDocument,
    pub profile_background: ProfileDocument,
    pub test_mode: bool,
    pub is_platform_moderator: bool,
    pub hot_group_exclusions: HotGroupExclusions,
    pub username: Timestamped<String>,
    pub display_name: Timestamped<Option<String>>,
    pub bio: Timestamped<String>,
    pub storage_limit: u64,
    pub phone_is_verified: bool,
    pub user_created: TimestampMillis,
    pub suspended: Timestamped<bool>,
    pub timer_jobs: TimerJobs<TimerJob>,
    pub contacts: Contacts,
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    pub fire_and_forget_handler: FireAndForgetHandler,
    pub saved_crypto_accounts: SavedCryptoAccounts,
    pub next_event_expiry: Option<TimestampMillis>,
    pub token_swaps: TokenSwaps,
    pub p2p_swaps: P2PSwaps,
    pub user_canister_events_queue: GroupedTimerJobQueue<LegacyUserCanisterEventBatch>,
    #[serde(default = "new_user_canister_events_by_canister")]
    pub user_canister_events_by_canister: GroupedTimerJobQueue<UserCanisterEventBatch>,
    pub video_call_operators: Vec<Principal>,
    pub pin_number: PinNumber,
    pub btc_address: Option<Timestamped<String>>,
    pub one_sec_address: Option<Timestamped<String>>,
    pub chit_events: ChitEvents,
    pub streak: Streak,
    pub achievements: HashSet<Achievement>,
    pub external_achievements: HashSet<String>,
    pub achievements_last_seen: TimestampMillis,
    pub unique_person_proof: Option<UniquePersonProof>,
    pub wallet_config: Timestamped<WalletConfig>,
    pub rng_seed: [u8; 32],
    pub referred_by: Option<UserId>,
    pub referrals: Referrals,
    pub message_activity_events: MessageActivityEvents,
    pub stable_memory_keys_to_garbage_collect: Vec<BaseKeyPrefix>,
    pub local_user_index_event_sync_queue: BatchedTimerJobQueue<LocalUserIndexEventBatch>,
    pub idempotency_checker: IdempotencyChecker,
    #[serde(default)]
    pub known_multi_user_canisters: HashSet<CanisterId>,
    pub bots: InstalledBots,
    pub premium_items: PremiumItems,
    #[serde(default)]
    pub game_chit_keys: GameChitKeys,
}

impl From<DataPrevious> for Data {
    fn from(d: DataPrevious) -> Data {
        Data {
            user: User {
                principal: d.owner,
                username: d.username,
                display_name: d.display_name,
                bio: d.bio,
                avatar: d.avatar,
                profile_background: d.profile_background,
                user_created: d.user_created,
                suspended: d.suspended,
                referred_by: d.referred_by,
                hot_group_exclusions: d.hot_group_exclusions,
                saved_crypto_accounts: d.saved_crypto_accounts,
                pin_number: d.pin_number,
                direct_chats: d.direct_chats,
                favourite_chats: d.favourite_chats,
                blocked_users: d.blocked_users,
                contacts: d.contacts,
                wallet_config: d.wallet_config,
                message_activity_events: d.message_activity_events,
                next_event_expiry: d.next_event_expiry,
                chit_events: d.chit_events,
                streak: d.streak,
                achievements: d.achievements,
                achievements_last_seen: d.achievements_last_seen,
                game_chit_keys: d.game_chit_keys,
                group_chats: d.group_chats,
                communities: d.communities,
                diamond_membership_expires_at: d.diamond_membership_expires_at,
                phone_is_verified: d.phone_is_verified,
                storage_limit: d.storage_limit,
                unique_person_proof: d.unique_person_proof,
                external_achievements: d.external_achievements,
                referrals: d.referrals,
            },
            user_index_canister_id: d.user_index_canister_id,
            local_user_index_canister_id: d.local_user_index_canister_id,
            group_index_canister_id: d.group_index_canister_id,
            identity_canister_id: d.identity_canister_id,
            escrow_canister_id: d.escrow_canister_id,
            test_mode: d.test_mode,
            is_platform_moderator: d.is_platform_moderator,
            timer_jobs: d.timer_jobs,
            fire_and_forget_handler: d.fire_and_forget_handler,
            token_swaps: d.token_swaps,
            p2p_swaps: d.p2p_swaps,
            user_canister_events_queue: d.user_canister_events_queue,
            user_canister_events_by_canister: d.user_canister_events_by_canister,
            video_call_operators: d.video_call_operators,
            btc_address: d.btc_address,
            one_sec_address: d.one_sec_address,
            rng_seed: d.rng_seed,
            stable_memory_keys_to_garbage_collect: d.stable_memory_keys_to_garbage_collect,
            local_user_index_event_sync_queue: d.local_user_index_event_sync_queue,
            idempotency_checker: d.idempotency_checker,
            known_multi_user_canisters: d.known_multi_user_canisters,
            bots: d.bots,
            premium_items: d.premium_items,
        }
    }
}
