//! The texts of the messages the OpenChat bot sends users, shared by the User and MultiUser
//! canisters, which each send them in their own way

use crate::Membership;
use constants::{DAY_IN_MS, HOUR_IN_MS, OPENCHAT_BOT_USER_ID};
use types::nns::Tokens;
use types::{ChannelId, CommunityId, SuspensionDuration, UserId};
use user_canister::{PhoneNumberConfirmed, StorageUpgraded, UserSuspended};
use utils::format::format_to_decimal_places;

pub fn community_deleted_text(deleted_by: UserId, name: &str, public: bool) -> String {
    let visibility = visibility(public);
    format!("The {visibility} community \"{name}\" was deleted by @UserId({deleted_by})")
}

pub fn group_deleted_text(deleted_by: UserId, group_name: &str, public: bool) -> String {
    let visibility = visibility(public);
    format!("The {visibility} group \"{group_name}\" was deleted by @UserId({deleted_by})")
}

pub fn group_imported_into_community_text(
    group_name: &str,
    public: bool,
    community_name: &str,
    community_id: CommunityId,
    channel_id: ChannelId,
) -> String {
    let visibility = visibility(public);
    format!(
        "The {visibility} group \"{group_name}\" was deleted because it was imported into the [\"{community_name}\"](/community/{community_id}/channel/{channel_id}) community"
    )
}

pub fn removed_from_group_or_community_text(
    is_group: bool,
    removed_by: UserId,
    group_or_community_name: &str,
    public: bool,
    blocked: bool,
) -> String {
    let visibility = visibility(public);
    let action = if blocked { "blocked" } else { "removed" };
    let group_or_community = if is_group { "group" } else { "community" };
    format!(
        "You were {action} from the {visibility} {group_or_community} \"{group_or_community_name}\" by @UserId({removed_by})"
    )
}

pub fn phone_number_confirmed_text(event: &PhoneNumberConfirmed) -> String {
    let storage_added = to_gb(event.storage_added);
    let new_group_limit = Membership::Diamond.group_creation_limit().to_string();
    let old_group_limit = Membership::Basic.group_creation_limit().to_string();
    format!(
        "Thank you for [verifying ownership of your phone number](/{OPENCHAT_BOT_USER_ID}?faq=sms_icp). This gives you {storage_added} GB of storage allowing you to send and store images, videos, audio and other files. It also entitles you to create {new_group_limit} groups (up from {old_group_limit})."
    )
}

pub fn storage_upgraded_text(event: &StorageUpgraded) -> String {
    let amount_paid = to_tokens(event.cost.amount);
    let token = &event.cost.token_symbol;
    let storage_added = to_gb(event.storage_added);
    let storage_total = to_gb(event.new_storage_limit);
    let new_group_limit = Membership::Diamond.group_creation_limit().to_string();
    let old_group_limit = Membership::Basic.group_creation_limit().to_string();

    if event.storage_added == event.new_storage_limit {
        format!(
            "Thank you for [buying storage](/{OPENCHAT_BOT_USER_ID}?faq=sms_icp). You paid {amount_paid} {token} for {storage_added} GB of storage. This will allow you to send and store images, videos, audio and other files. It also entitles you to create {new_group_limit} groups (up from {old_group_limit})."
        )
    } else {
        format!(
            "Thank you for buying more storage. You paid {amount_paid} {token} for {storage_added} GB of storage giving you {storage_total} GB in total."
        )
    }
}

// The message mentions the user, so the caller sends it with them as a mentioned user
pub fn referred_user_joined_text(user_id: UserId) -> String {
    format!("User @UserId({user_id}) has just registered with your referral code!")
}

pub fn user_suspended_text(event: &UserSuspended) -> String {
    let action = match event.duration {
        SuspensionDuration::Duration(ms) => {
            if ms < 2 * DAY_IN_MS {
                let hours = ms / HOUR_IN_MS;
                format!("unsuspended in {hours} hours")
            } else {
                let days = ms / DAY_IN_MS;
                format!("unsuspended in {days} days")
            }
        }
        SuspensionDuration::Indefinitely => "deleted in 90 days".to_string(),
    };

    let reason = &event.reason;

    format!(
        "Your account has been suspended.

Reason:
\"{reason}\"

You can appeal this suspension by emailing safety@openchatlabs.org otherwise your account will be {action}."
    )
}

pub const DIAMOND_MEMBERSHIP_PAYMENT_RECEIVED_TEXT: &str = "Payment received for Diamond membership!";

pub fn streak_insurance_claimed_text(new_streak: u16, days_remaining: u8) -> String {
    let days_remaining_text = if days_remaining == 1 { "1 day".to_string() } else { format!("{days_remaining} days") };
    format!(
        "One day of streak insurance was just used up to protect your streak from being lost. \
Your streak is now {new_streak} days and you have {days_remaining_text} of streak insurance remaining."
    )
}

pub fn missed_daily_claims_reinstated_text(count: usize, new_streak: u16) -> String {
    let first_line = if count == 1 {
        "missed daily claim has been reinstated."
    } else {
        "missed daily claims have been reinstated."
    };
    format!(
        "{count} {first_line}
Your streak is now {new_streak} days!"
    )
}

pub fn btc_deposit_received_text(formatted_amount: &str) -> String {
    format!(
        "BTC deposit received!
Your account has been credited with {formatted_amount} BTC."
    )
}

pub fn btc_deposit_failed_text(error: &str) -> String {
    format!(
        "Failed to credit account with BTC:
Error: {error:?}",
    )
}

fn visibility(public: bool) -> &'static str {
    if public { "public" } else { "private" }
}

fn to_gb(bytes: u64) -> String {
    const BYTES_PER_1GB: u64 = 1024 * 1024 * 1024;
    format_to_decimal_places(bytes as f64 / BYTES_PER_1GB as f64, 2)
}

fn to_tokens(tokens: Tokens) -> String {
    const E8S_PER_TOKEN: u64 = 100_000_000;
    format_to_decimal_places(tokens.e8s() as f64 / E8S_PER_TOKEN as f64, 8)
}
