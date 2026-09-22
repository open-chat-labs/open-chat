use crate::{User, openchat_bot};
use chat_events::{MessageContentInternal, TextContentInternal};
use stable_memory_map::BaseKeyPrefix;
use types::{Achievement, DiamondMembershipPlanDuration, ReferralStatus, TimestampMillis, Timestamped, UserId};
use user_canister::LocalUserIndexEvent;
use user_canister::mark_read::ChannelMessagesRead;

// A message for the OpenChat bot to send the user
pub struct BotMessage {
    pub content: MessageContentInternal,
    pub mentioned: Vec<types::User>,
}

impl BotMessage {
    pub(crate) fn text(text: String) -> BotMessage {
        BotMessage {
            content: MessageContentInternal::Text(TextContentInternal { text }),
            mentioned: Vec::new(),
        }
    }
}

// What applying an event leaves the caller to do
#[derive(Default)]
pub struct Effects {
    // Tell the LocalUserIndex of the user's CHIT balance
    pub chit_changed: bool,
    pub bot_messages: Vec<BotMessage>,
    // Tell whoever referred the user of the status they have reached
    pub referral_status: Option<(UserId, ReferralStatus)>,
    // Stable memory entries to garbage collect
    pub garbage_collect: Vec<BaseKeyPrefix>,
}

// Applies an event from the LocalUserIndex to the user
pub fn apply(user: &mut User, event: LocalUserIndexEvent, now: TimestampMillis) -> Effects {
    let mut effects = Effects::default();

    match event {
        LocalUserIndexEvent::UsernameChanged(ev) => {
            user.username = Timestamped::new(ev.username, now);
        }
        LocalUserIndexEvent::DisplayNameChanged(ev) => {
            user.display_name = Timestamped::new(ev.display_name, now);
            effects.chit_changed |= user.award_achievement(Achievement::SetDisplayName, now);
        }
        LocalUserIndexEvent::PhoneNumberConfirmed(ev) => {
            user.phone_is_verified = true;
            user.storage_limit = ev.new_storage_limit;
            effects
                .bot_messages
                .push(BotMessage::text(openchat_bot::phone_number_confirmed_text(&ev)));
        }
        LocalUserIndexEvent::StorageUpgraded(ev) => {
            user.storage_limit = ev.new_storage_limit;
            effects
                .bot_messages
                .push(BotMessage::text(openchat_bot::storage_upgraded_text(&ev)));
        }
        LocalUserIndexEvent::ReferredUserRegistered(ev) => {
            user.referrals.set_status(ev.user_id, ReferralStatus::Registered, now);
            effects.bot_messages.push(BotMessage {
                content: MessageContentInternal::Text(TextContentInternal {
                    text: openchat_bot::referred_user_joined_text(ev.user_id),
                }),
                mentioned: vec![types::User {
                    user_id: ev.user_id,
                    username: ev.username,
                }],
            });
        }
        LocalUserIndexEvent::UserSuspended(ev) => {
            effects
                .bot_messages
                .push(BotMessage::text(openchat_bot::user_suspended_text(&ev)));
        }
        LocalUserIndexEvent::OpenChatBotMessageV2(message) => {
            effects.bot_messages.push(BotMessage {
                content: message.content.into(),
                mentioned: message.mentioned,
            });
        }
        LocalUserIndexEvent::UserJoinedGroup(ev) => {
            // Check that the user didn't already leave the group before this event arrived
            if !user
                .group_chats
                .removed_since(ev.group_canister_timestamp)
                .contains(&ev.chat_id)
            {
                user.group_chats
                    .join(ev.chat_id, ev.local_user_index_canister_id, ev.latest_message_index, now);
                user.hot_group_exclusions.remove(&ev.chat_id, now);
                effects.chit_changed |= user.award_achievement(Achievement::JoinedGroup, now);
            }
        }
        LocalUserIndexEvent::UserJoinedCommunityOrChannel(ev) => {
            // Check that the user didn't already leave the community before this event arrived
            if !user
                .communities
                .removed_since(ev.community_canister_timestamp)
                .contains(&ev.community_id)
            {
                let (community, _) = user.communities.join(ev.community_id, ev.local_user_index_canister_id, now);
                community.mark_read(
                    ev.channels
                        .into_iter()
                        .map(|c| ChannelMessagesRead {
                            channel_id: c.channel_id,
                            read_up_to: c.latest_message_index,
                            threads: Vec::new(),
                            date_read_pinned: None,
                        })
                        .collect(),
                    now,
                );
                effects.chit_changed |= user.award_achievement(Achievement::JoinedCommunity, now);
            }
        }
        LocalUserIndexEvent::DiamondMembershipPaymentReceived(ev) => {
            let lifetime = matches!(ev.duration, DiamondMembershipPlanDuration::Lifetime);
            effects.chit_changed |= user.award_achievement(Achievement::UpgradedToDiamond, now);
            if lifetime {
                effects.chit_changed |= user.award_achievement(Achievement::UpgradedToGoldDiamond, now);
            }

            user.diamond_membership_expires_at = Some(ev.expires_at);

            if ev.send_bot_message {
                effects.bot_messages.push(BotMessage::text(
                    openchat_bot::DIAMOND_MEMBERSHIP_PAYMENT_RECEIVED_TEXT.to_string(),
                ));
            }

            if let Some(referred_by) = user.referred_by {
                let status = if lifetime { ReferralStatus::LifetimeDiamond } else { ReferralStatus::Diamond };
                effects.referral_status = Some((referred_by, status));
            }
        }
        LocalUserIndexEvent::NotifyUniquePersonProof(proof) => {
            effects.chit_changed |= user.award_achievement(Achievement::ProvedUniquePersonhood, now);
            user.unique_person_proof = Some(*proof);

            if let Some(referred_by) = user.referred_by {
                effects.referral_status = Some((referred_by, ReferralStatus::UniquePerson));
            }
        }
        LocalUserIndexEvent::ExternalAchievementAwarded(ev) => {
            effects.chit_changed |= user.award_external_achievement(ev.name, ev.chit_reward, now);
        }
        LocalUserIndexEvent::ReinstateMissedDailyClaims(days) => {
            let (count, new_streak) = user.reinstate_missed_daily_claims(days, now);
            effects
                .bot_messages
                .push(BotMessage::text(openchat_bot::missed_daily_claims_reinstated_text(
                    count, new_streak,
                )));
            effects.chit_changed |= true;
        }
        LocalUserIndexEvent::BotRemoved(bot_id) => {
            effects.garbage_collect = user.uninstall_bot(bot_id, now);
        }
        LocalUserIndexEvent::BotUpdated(ev) => {
            user.handle_bot_definition_updated(*ev, now);
        }
    }

    effects
}
