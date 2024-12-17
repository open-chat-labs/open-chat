pub mod account_billing;
pub mod chit_leaderboard;
pub mod diamond_membership_details;
pub mod external_achievements;
pub mod local_user_index_map;
pub mod pending_modclub_submissions_queue;
pub mod pending_payments_queue;
pub mod reported_messages;
pub mod storage_index_user_config_batch;
pub mod streak_insurance_logs;
pub mod user;
pub mod user_map;

pub const MAX_AVATAR_SIZE: usize = 250_000;
pub const MAX_DESCRIPTION_LEN: usize = 10_000;
pub const MAX_COMMANDS: usize = 100;
