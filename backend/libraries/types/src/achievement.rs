use crate::{Message, MessageIndex};
use candid::CandidType;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Clone, Debug, PartialEq, Eq, Hash)]
pub enum Achievement {
    JoinedGroup,
    JoinedCommunity,
    SentDirectMessage,
    ReceivedDirectMessage,
    SetAvatar,
    SetBio,
    SetDisplayName,
    UpgradedToDiamond,
    UpgradedToGoldDiamond,
    Streak3,
    Streak7,
    Streak14,
    Streak30,
    Streak100,
    Streak365,
    SentPoll,
    SentText,
    SentImage,
    SentVideo,
    SentAudio,
    SentFile,
    SentGiphy,
    SentPrize,
    SentMeme,
    SentCrypto,
    SentP2PSwapOffer,
    StartedCall,
    ReactedToMessage,
    EditedMessage,
    RepliedInThread,
    QuoteReplied,
    TippedMessage,
    DeletedMessage,
    ForwardedMessage,
    ProvedUniquePersonhood,

    ReceivedCrypto,
    HadMessageReactedTo,
    HadMessageTipped,
    VotedOnPoll,
    SentReminder,
    JoinedCall,
    AcceptedP2PSwapOffer,
    SetCommunityDisplayName,
    Referred1stUser,
    Referred3rdUser,
    Referred10thUser,
    Referred20thUser,
    Referred50thUser,

    PinnedMessage,
    SwappedFromWallet,
    FavouritedChat,
    FollowedThread,
    SuggestedTranslation,
    TranslationAccepted,
    AppointedGroupModerator,
    AppointedGroupAdmin,
    AppointedGroupOwner,
    ChosenAsGroupModerator,
    ChosenAsGroupAdmin,
    ChosenAsGroupOwner,
    SetGroupAccessGate,
    SetCommunityAccessGate,
    JoinedGatedGroupOrCommunity,

    ChangedTheme,
    EnabledDisappearingMessages,
    OwnGroupWithOneDiamondMember,
    OwnGroupWithTenDiamondMembers,
    OwnGroupWithOneHundredDiamondMembers,
    OwnGroupWithOneThousandDiamondMembers,
    DirectChats5,
    DirectChats10,
    DirectChats20,
}

impl Achievement {
    pub fn chit_reward(&self) -> u32 {
        match self {
            Achievement::JoinedGroup => 500,
            Achievement::JoinedCommunity => 500,
            Achievement::SentDirectMessage => 700,
            Achievement::ReceivedDirectMessage => 1000,
            Achievement::SetAvatar => 1000,
            Achievement::SetBio => 1000,
            Achievement::SetDisplayName => 500,
            Achievement::UpgradedToDiamond => 5000,
            Achievement::UpgradedToGoldDiamond => 15000,
            Achievement::Streak3 => 1000,
            Achievement::Streak7 => 3000,
            Achievement::Streak14 => 5000,
            Achievement::Streak30 => 10000,
            Achievement::Streak100 => 20000,
            Achievement::Streak365 => 50000,
            Achievement::ProvedUniquePersonhood => 10000,
            Achievement::SetCommunityDisplayName => 700,
            Achievement::ChangedTheme => 800,
            Achievement::SentCrypto => 2000,
            Achievement::ReceivedCrypto => 3000,
            Achievement::ReactedToMessage => 400,
            Achievement::HadMessageReactedTo => 800,
            Achievement::TippedMessage => 1500,
            Achievement::HadMessageTipped => 2500,
            Achievement::SwappedFromWallet => 3000,
            Achievement::SentP2PSwapOffer => 1000,
            Achievement::AcceptedP2PSwapOffer => 4000,
            Achievement::SentText => 700,
            Achievement::SentPoll => 1000,
            Achievement::VotedOnPoll => 1000,
            Achievement::SentImage => 1000,
            Achievement::SentVideo => 1000,
            Achievement::SentAudio => 1000,
            Achievement::SentFile => 1000,
            Achievement::SentGiphy => 1000,
            Achievement::SentPrize => 3000,
            Achievement::SentMeme => 2000,
            Achievement::SentReminder => 1500,
            Achievement::StartedCall => 2000,
            Achievement::JoinedCall => 3000,
            Achievement::EnabledDisappearingMessages => 1000,
            Achievement::RepliedInThread => 1500,
            Achievement::QuoteReplied => 1500,
            Achievement::EditedMessage => 1000,
            Achievement::DeletedMessage => 700,
            Achievement::ForwardedMessage => 2000,
            Achievement::PinnedMessage => 2000,
            Achievement::FavouritedChat => 2000,
            Achievement::FollowedThread => 3000,
            Achievement::SuggestedTranslation => 5000,
            Achievement::TranslationAccepted => 10000,
            Achievement::AppointedGroupModerator => 2000,
            Achievement::AppointedGroupAdmin => 3000,
            Achievement::AppointedGroupOwner => 5000,
            Achievement::ChosenAsGroupModerator => 3000,
            Achievement::ChosenAsGroupAdmin => 4000,
            Achievement::ChosenAsGroupOwner => 5000,
            Achievement::SetGroupAccessGate => 2000,
            Achievement::SetCommunityAccessGate => 2000,
            Achievement::JoinedGatedGroupOrCommunity => 3000,
            Achievement::OwnGroupWithOneDiamondMember => 3000,
            Achievement::OwnGroupWithTenDiamondMembers => 15000,
            Achievement::OwnGroupWithOneHundredDiamondMembers => 50000,
            Achievement::OwnGroupWithOneThousandDiamondMembers => 200000,
            Achievement::DirectChats5 => 2000,
            Achievement::DirectChats10 => 4000,
            Achievement::DirectChats20 => 10000,
            Achievement::Referred1stUser => 5000,
            Achievement::Referred3rdUser => 10000,
            Achievement::Referred10thUser => 20000,
            Achievement::Referred20thUser => 30000,
            Achievement::Referred50thUser => 50000,
        }
    }

    pub fn from_message(direct: bool, message: &Message, is_thread: bool) -> Vec<Achievement> {
        let mut achievements = Vec::new();

        if let Some(achievement) = message.content.to_achievement() {
            achievements.push(achievement);
        }

        if direct {
            achievements.push(Achievement::SentDirectMessage);
        }

        if message.forwarded {
            achievements.push(Achievement::ForwardedMessage);
        }

        if message.replies_to.is_some() {
            achievements.push(Achievement::QuoteReplied);
        } else if is_thread && message.message_index == MessageIndex::from(0) {
            achievements.push(Achievement::RepliedInThread);
        }

        achievements
    }
}
