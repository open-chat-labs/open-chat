use crate::{ChannelId, MessageId, MessageIndex};
use serde::{Deserialize, Serialize};

// A set of OpenAI moderation categories, stored as a bitfield. Deliberately not serializable:
// it travels on the wire as a raw u32 and must be rebuilt via `from_bits` so that unknown bits
// cannot enter.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct ModerationCategories(u32);

impl ModerationCategories {
    pub const SEXUAL: ModerationCategories = ModerationCategories(1);
    pub const SEXUAL_MINORS: ModerationCategories = ModerationCategories(1 << 1);
    pub const VIOLENCE: ModerationCategories = ModerationCategories(1 << 2);
    pub const VIOLENCE_GRAPHIC: ModerationCategories = ModerationCategories(1 << 3);
    pub const HARASSMENT: ModerationCategories = ModerationCategories(1 << 4);
    pub const HARASSMENT_THREATENING: ModerationCategories = ModerationCategories(1 << 5);
    pub const SELF_HARM: ModerationCategories = ModerationCategories(1 << 6);
    pub const ILLICIT: ModerationCategories = ModerationCategories(1 << 7);

    const ALL: u32 = (1 << 8) - 1;

    pub fn from_bits(bits: u32) -> Option<ModerationCategories> {
        (bits & !Self::ALL == 0).then_some(ModerationCategories(bits))
    }

    pub fn bits(&self) -> u32 {
        self.0
    }

    pub fn is_empty(&self) -> bool {
        self.0 == 0
    }

    pub fn contains(&self, other: ModerationCategories) -> bool {
        self.0 & other.0 == other.0
    }

    pub fn intersects(&self, other: ModerationCategories) -> bool {
        self.0 & other.0 != 0
    }
}

impl std::ops::BitOr for ModerationCategories {
    type Output = ModerationCategories;

    fn bitor(self, rhs: ModerationCategories) -> ModerationCategories {
        ModerationCategories(self.0 | rhs.0)
    }
}

// Content to be classified by the moderation API. Only the text is ever classified - media is
// never sent to the API (see openai_moderation.rs). image_urls carries the media references for
// evidence quarantine and stays populated for wire compatibility.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ModerationInput {
    pub text: Option<String>,
    pub image_urls: Vec<String>,
}

impl ModerationInput {
    // "Empty" means nothing classifiable: only text is classified, so input carrying media but
    // no text is empty
    pub fn is_empty(&self) -> bool {
        self.text.as_ref().is_none_or(|t| t.trim().is_empty())
    }
}

// A request from a group/community canister for the local_user_index to classify a message
// via the moderation API. channel_id is set when the source is a community canister.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ClassifyMessageRequest {
    pub channel_id: Option<ChannelId>,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub input: ModerationInput,
}

// The classification result routed back from the local_user_index to the canister which owns
// the message. flags of 0 still triggers flag_message so that stale flags are cleared when a
// previously flagged message has been edited to something clean.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MessageClassified {
    pub channel_id: Option<ChannelId>,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub flags: u32,
    // Categories which scored above the moderation-referral threshold: the message is
    // referred for human review as a suspected ToS violation (no automatic action is ever
    // taken on these)
    #[serde(default)]
    pub moderation_referral_flags: u32,
}

// Operator config determining which classifier categories (other than sexual/minors, which
// always takes the CSAM auto-sanction path) refer a message for human moderator review, and
// the confidence score each requires. Thresholds are per category because the right value
// differs: high enough to keep noise out of the review queue, low enough to catch the target
// content. None/empty = referral disabled.
#[ts_export::ts_export]
#[derive(candid::CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ModerationReferralConfig {
    pub categories: Vec<ModerationReferralCategory>,
}

#[ts_export::ts_export]
#[derive(candid::CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
pub struct ModerationReferralCategory {
    // A single ModerationCategories bit
    pub category: u32,
    pub score_threshold: f64,
}
