//! Decides which call pushes reach a device. The user, group and community canisters emit facts
//! about a call and hold no policy; the policy lives here, where a change is one canister
//! release instead of a fleet release. See open-chat #9456.

use types::{CallFacts, Chat, Milliseconds, UserNotificationPayload, VideoCallType};

/// A private group rings its members when it has this many or fewer
pub const MAX_RINGING_GROUP_SIZE: u32 = 8;

// How long a phone rings, and how long its decline token is good for (#9534).
pub const RING_WINDOW_MS: Milliseconds = 40 * 1000;

/// Whether a call in this chat should ring the recipient's phone. A direct call rings. A call
/// in a small private group rings. Nothing else does, and a broadcast never does.
pub fn rings(chat: &Chat, call_type: VideoCallType, is_public: bool, member_count: u32) -> bool {
    match chat {
        Chat::Direct(_) => true,
        Chat::Group(_) => call_type != VideoCallType::Broadcast && !is_public && member_count <= MAX_RINGING_GROUP_SIZE,
        Chat::Channel(..) => false,
    }
}

/// The call this notification is about, if it is about one, and whether that call rings
pub fn ringing_call(payload: &UserNotificationPayload) -> Option<(CallFacts, bool)> {
    match payload {
        UserNotificationPayload::DirectMessage(n) => n.call.map(|f| {
            (
                f,
                rings(&Chat::Direct(n.sender.into()), f.call_type, f.is_public, f.member_count),
            )
        }),
        UserNotificationPayload::GroupMessage(n) => n
            .call
            .map(|f| (f, rings(&Chat::Group(n.chat_id), f.call_type, f.is_public, f.member_count))),
        UserNotificationPayload::ChannelMessage(n) => n.call.map(|f| {
            (
                f,
                rings(
                    &Chat::Channel(n.community_id, n.channel_id),
                    f.call_type,
                    f.is_public,
                    f.member_count,
                ),
            )
        }),
        _ => None,
    }
}

/// Whether a dismissal is for a call that rang. A dismissal for a call that never rang has
/// nothing to dismiss and is dropped.
pub fn dismissal_rang(payload: &UserNotificationPayload) -> Option<bool> {
    match payload {
        UserNotificationPayload::DirectCallDismissed(_) => Some(true),
        UserNotificationPayload::GroupCallDismissed(n) => {
            // the kind of call is not on the dismissal: a broadcast never has participants to
            // dismiss for, and a public group is refused by the policy whatever the kind
            Some(rings(
                &Chat::Group(n.chat_id),
                VideoCallType::Default,
                n.is_public,
                n.member_count,
            ))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use types::{ChannelId, ChatId, CommunityId};

    fn chat_id() -> ChatId {
        Principal::from_slice(&[1]).into()
    }

    // #9456 invariant 1: a call in a channel, a public group, a private group with more than
    // eight members, or any broadcast call never rings
    #[test]
    fn invariant_1_only_direct_calls_and_small_private_group_calls_ring() {
        assert!(rings(&Chat::Direct(chat_id()), VideoCallType::Default, false, 2));
        assert!(rings(
            &Chat::Group(chat_id()),
            VideoCallType::Default,
            false,
            MAX_RINGING_GROUP_SIZE
        ));

        assert!(!rings(
            &Chat::Group(chat_id()),
            VideoCallType::Default,
            false,
            MAX_RINGING_GROUP_SIZE + 1
        ));
        assert!(!rings(&Chat::Group(chat_id()), VideoCallType::Default, true, 2));
        assert!(!rings(&Chat::Group(chat_id()), VideoCallType::Broadcast, false, 2));
        assert!(!rings(
            &Chat::Channel(CommunityId::from(Principal::from_slice(&[2])), ChannelId::from(3u32)),
            VideoCallType::Default,
            false,
            2
        ));
    }

    // #9456 invariant 12: a dismissal for a call the policy would not ring is dropped
    #[test]
    fn invariant_12_a_dismissal_for_a_call_that_never_rang_is_dropped() {
        let big = |member_count| {
            UserNotificationPayload::GroupCallDismissed(types::GroupCallDismissedNotification {
                chat_id: chat_id(),
                message_id: 1u64.into(),
                kind: types::CallDismissalKind::Ended,
                is_public: false,
                member_count,
            })
        };
        assert_eq!(dismissal_rang(&big(MAX_RINGING_GROUP_SIZE)), Some(true));
        assert_eq!(dismissal_rang(&big(MAX_RINGING_GROUP_SIZE + 1)), Some(false));
    }
}
