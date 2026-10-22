use std::any::type_name;
use std::collections::BTreeSet;
use types::{icrc1, nns};

pub trait Variants {
    const ALL: &'static [&'static str];

    fn variant(&self) -> &'static str;
}

// The match has no wildcard, so a variant added to one of these enums fails to compile until it's
// listed here, and `every` then fails until the samples include it
macro_rules! variants {
    ($ty:ty, [$($variant:ident),+ $(,)?]) => {
        impl Variants for $ty {
            const ALL: &'static [&'static str] = &[$(stringify!($variant)),+];

            fn variant(&self) -> &'static str {
                match self {
                    $(Self::$variant { .. } => stringify!($variant),)+
                }
            }
        }
    };
}

/// Returns `values`, having checked they include every variant of `T`
pub fn every<T: Variants>(values: Vec<T>) -> Vec<T> {
    let covered: BTreeSet<_> = values.iter().map(|v| v.variant()).collect();
    let missing: Vec<_> = T::ALL.iter().filter(|v| !covered.contains(*v)).collect();
    assert!(missing.is_empty(), "No sample of {} {missing:?}", type_name::<T>());
    values
}

variants!(
    types::MessageContent,
    [
        Text,
        Image,
        Video,
        Audio,
        File,
        Poll,
        Crypto,
        Deleted,
        Giphy,
        GovernanceProposal,
        Prize,
        PrizeWinner,
        MessageReminderCreated,
        MessageReminder,
        ReportedMessage,
        ModerationReport,
        P2PSwap,
        VideoCall,
        Encrypted,
        Custom,
    ]
);

variants!(types::BotMessageContent, [Text, Image, Video, Audio, File, Poll, Giphy]);

variants!(types::CryptoTransaction, [Pending, Completed, Failed]);
variants!(types::PendingCryptoTransaction, [NNS, ICRC1, ICRC2, Certified]);
variants!(types::CompletedCryptoTransaction, [NNS, ICRC1, ICRC2]);
variants!(types::FailedCryptoTransaction, [NNS, ICRC1, ICRC2]);
variants!(nns::CryptoAccount, [Mint, Account]);
variants!(nns::UserOrAccount, [Account]);
variants!(icrc1::CryptoAccount, [Mint, Account]);
variants!(types::Proposal, [NNS, SNS]);
variants!(
    types::ProposalDecisionStatus,
    [Unspecified, Open, Rejected, Adopted, Executed, Failed]
);
variants!(
    types::ProposalRewardStatus,
    [Unspecified, AcceptVotes, ReadyToSettle, Settled]
);
variants!(types::TotalVotes, [Visible, Anonymous, Hidden]);
variants!(
    types::P2PSwapStatus,
    [Open, Cancelled, Expired, Reserved, Accepted, Completed]
);
variants!(
    types::ModerationReportStatus,
    [Pending, Contested, Upheld, UpheldAsCsam, Dismissed]
);
variants!(
    types::AuthorityReportState,
    [Due, Filed, Attempting, ContingencyRequired, ValidationFailed]
);
variants!(types::MediaScanProvider, [PhotoDna]);
variants!(
    types::EncryptedMessageContentType,
    [Text, Image, Video, Audio, File, Crypto, Giphy, Custom]
);
variants!(types::VideoCallType, [Broadcast, Default]);
variants!(types::Chat, [Direct, Group, Channel]);

variants!(
    oc_bots_sdk::types::MessageContentInitial,
    [Text, Image, Video, Audio, File, Poll, Giphy, Custom]
);
