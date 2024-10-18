use crate::message_content_internal::icrc1::AccountInternal;
use crate::stable_storage::tests::test_values::{
    AUDIO, CRYPTO, CUSTOM, DELETED, FILE, GIPHY, GOVERNANCE_PROPOSAL, IMAGE, MESSAGE_REMINDER, MESSAGE_REMINDER_CREATED,
    P2P_SWAP, POLL, PRIZE, PRIZE_WINNER, REPORTED_MESSAGE, TEXT, VIDEO, VIDEO_CALL,
};
use crate::stable_storage::Value;
use crate::{
    AudioContentInternal, BlobReferenceInternal, CallParticipantInternal, ChatEventInternal, ChatInternal,
    CompletedCryptoTransactionInternal, CryptoContentInternal, CustomContentInternal, DeletedByInternal, FileContentInternal,
    GiphyContentInternal, GiphyImageVariantInternal, ImageContentInternal, MessageContentInternal, MessageInternal,
    MessageReminderContentInternal, MessageReminderCreatedContentInternal, P2PSwapContentInternal, PollConfigInternal,
    PollContentInternal, PrizeContentInternal, PrizeWinnerContentInternal, ProposalContentInternal, ReplyContextInternal,
    ReportedMessageInternal, TextContentInternal, ThreadSummaryInternal, VideoCallContentInternal, VideoContentInternal,
};
use ic_stable_structures::Storable;
use rand::random;
use std::borrow::Cow;
use testing::rng::{random_principal, random_string, random_u128, random_u32};
use types::{
    Cryptocurrency, EventIndex, EventWrapperInternal, MessageReport, P2PSwapCompleted, P2PSwapStatus, Proposal,
    ProposalDecisionStatus, ProposalRewardStatus, Reaction, SnsProposal, Tally, ThumbnailData, Timestamped, Tips, TokenInfo,
    VideoCallPresence, VideoCallType,
};

mod test_values;

#[test]
fn text_content() {
    let content = MessageContentInternal::Text(TextContentInternal { text: random_string() });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::Text(_)));
    assert!(matches!(test_deserialization(TEXT), MessageContentInternal::Text(_)));
}

#[test]
fn image_content() {
    let content = MessageContentInternal::Image(ImageContentInternal {
        width: random(),
        height: random(),
        thumbnail_data: ThumbnailData(random_string()),
        caption: Some(random_string()),
        mime_type: random_string(),
        blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(),
            blob_id: random(),
        }),
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::Image(_)));
    assert!(matches!(test_deserialization(IMAGE), MessageContentInternal::Image(_)));
}

#[test]
fn video_content() {
    let content = MessageContentInternal::Video(VideoContentInternal {
        width: random(),
        height: random(),
        thumbnail_data: ThumbnailData(random_string()),
        caption: Some(random_string()),
        mime_type: random_string(),
        image_blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(),
            blob_id: random(),
        }),
        video_blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(),
            blob_id: random(),
        }),
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::Video(_)));
    assert!(matches!(test_deserialization(VIDEO), MessageContentInternal::Video(_)));
}

#[test]
fn audio_content() {
    let content = MessageContentInternal::Audio(AudioContentInternal {
        caption: Some(random_string()),
        mime_type: random_string(),
        blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(),
            blob_id: random(),
        }),
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::Audio(_)));
    assert!(matches!(test_deserialization(AUDIO), MessageContentInternal::Audio(_)));
}

#[test]
fn file_content() {
    let content = MessageContentInternal::File(FileContentInternal {
        name: random_string(),
        caption: Some(random_string()),
        mime_type: random_string(),
        file_size: random(),
        blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(),
            blob_id: random(),
        }),
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::File(_)));
    assert!(matches!(test_deserialization(FILE), MessageContentInternal::File(_)));
}

#[test]
fn poll_content() {
    let content = MessageContentInternal::Poll(PollContentInternal {
        config: PollConfigInternal {
            text: Some(random_string()),
            options: vec![random_string(), random_string(), random_string()],
            end_date: Some(random()),
            anonymous: true,
            show_votes_before_end_date: true,
            allow_multiple_votes_per_user: true,
            allow_user_to_change_vote: true,
        },
        votes: [(random(), vec![random_principal(), random_principal()])]
            .into_iter()
            .collect(),
        ended: true,
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::Poll(_)));
    assert!(matches!(test_deserialization(POLL), MessageContentInternal::Poll(_)));
}

#[test]
fn crypto_content() {
    let content = MessageContentInternal::Crypto(CryptoContentInternal {
        recipient: random_principal(),
        transfer: CompletedCryptoTransactionInternal::ICRC1(crate::icrc1::CompletedCryptoTransactionInternal {
            ledger: random_principal(),
            token: Cryptocurrency::CHAT,
            amount: random(),
            from: crate::icrc1::CryptoAccountInternal::Account(AccountInternal {
                owner: random_principal(),
                subaccount: Some(random()),
            }),
            to: crate::icrc1::CryptoAccountInternal::Account(AccountInternal {
                owner: random_principal(),
                subaccount: Some(random()),
            }),
            fee: random(),
            memo: Some(random_u128::<u128>().to_be_bytes().to_vec().into()),
            created: random(),
            block_index: random(),
        }),
        caption: Some(random_string()),
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::Crypto(_)));
    assert!(matches!(test_deserialization(CRYPTO), MessageContentInternal::Crypto(_)));
}

#[test]
fn deleted_content() {
    let content = MessageContentInternal::Deleted(DeletedByInternal {
        deleted_by: random_principal(),
        timestamp: random(),
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::Deleted(_)));
    assert!(matches!(test_deserialization(DELETED), MessageContentInternal::Deleted(_)));
}

#[test]
fn giphy_content() {
    let content = MessageContentInternal::Giphy(GiphyContentInternal {
        caption: Some(random_string()),
        title: random_string(),
        desktop: GiphyImageVariantInternal {
            width: random(),
            height: random(),
            url: random_string(),
            mime_type: random_string(),
        },
        mobile: GiphyImageVariantInternal {
            width: random(),
            height: random(),
            url: random_string(),
            mime_type: random_string(),
        },
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::Giphy(_)));
    assert!(matches!(test_deserialization(GIPHY), MessageContentInternal::Giphy(_)));
}

#[test]
fn governance_proposal() {
    let content = MessageContentInternal::GovernanceProposal(ProposalContentInternal {
        governance_canister_id: random_principal(),
        proposal: Proposal::SNS(SnsProposal {
            id: random(),
            action: random(),
            proposer: random(),
            created: random(),
            title: random_string(),
            summary: random_string(),
            url: random_string(),
            status: ProposalDecisionStatus::Executed,
            reward_status: ProposalRewardStatus::Settled,
            tally: Tally {
                yes: random(),
                no: random(),
                total: random(),
                timestamp: random(),
            },
            deadline: random(),
            payload_text_rendering: Some(random_string()),
            minimum_yes_proportion_of_total: random(),
            minimum_yes_proportion_of_exercised: random(),
            last_updated: random(),
        }),
        votes: [(random_principal(), true), (random_principal(), false)]
            .into_iter()
            .collect(),
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(
        test_deserialization(&bytes),
        MessageContentInternal::GovernanceProposal(_)
    ));
    assert!(matches!(
        test_deserialization(GOVERNANCE_PROPOSAL),
        MessageContentInternal::GovernanceProposal(_)
    ));
}

#[test]
fn prize_content() {
    let content = MessageContentInternal::Prize(PrizeContentInternal {
        prizes_remaining: vec![random(), random(), random()],
        reservations: [random_principal(), random_principal(), random_principal()]
            .into_iter()
            .collect(),
        winners: [random_principal(), random_principal(), random_principal()]
            .into_iter()
            .collect(),
        transaction: CompletedCryptoTransactionInternal::NNS(crate::nns::CompletedCryptoTransactionInternal {
            ledger: random_principal(),
            token: Cryptocurrency::CHAT,
            amount: random(),
            fee: random(),
            from: crate::nns::CryptoAccountInternal::Account(random::<[u8; 28]>().try_into().unwrap()),
            to: crate::nns::CryptoAccountInternal::Account(random::<[u8; 28]>().try_into().unwrap()),
            memo: random(),
            created: random(),
            transaction_hash: random(),
            block_index: random(),
        }),
        end_date: random(),
        caption: Some(random_string()),
        diamond_only: true,
        refund_started: true,
        ledger_error: true,
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::Prize(_)));
    assert!(matches!(test_deserialization(PRIZE), MessageContentInternal::Prize(_)));
}

#[test]
fn prize_winner_content() {
    let content = MessageContentInternal::PrizeWinner(PrizeWinnerContentInternal {
        winner: random_principal(),
        ledger: random_principal(),
        token_symbol: random_string(),
        amount: random(),
        fee: random(),
        block_index: random(),
        prize_message: random_u32(),
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::PrizeWinner(_)));
    assert!(matches!(
        test_deserialization(PRIZE_WINNER),
        MessageContentInternal::PrizeWinner(_)
    ));
}

#[test]
fn message_reminder_created_content() {
    let content = MessageContentInternal::MessageReminderCreated(MessageReminderCreatedContentInternal {
        reminder_id: random(),
        remind_at: random(),
        notes: Some(random_string()),
        hidden: random(),
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(
        test_deserialization(&bytes),
        MessageContentInternal::MessageReminderCreated(_)
    ));
    assert!(matches!(
        test_deserialization(MESSAGE_REMINDER_CREATED),
        MessageContentInternal::MessageReminderCreated(_)
    ));
}

#[test]
fn message_reminder_content() {
    let content = MessageContentInternal::MessageReminder(MessageReminderContentInternal {
        reminder_id: random(),
        notes: Some(random_string()),
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(
        test_deserialization(&bytes),
        MessageContentInternal::MessageReminder(_)
    ));
    assert!(matches!(
        test_deserialization(MESSAGE_REMINDER),
        MessageContentInternal::MessageReminder(_)
    ));
}

#[test]
fn reported_message_content() {
    let content = MessageContentInternal::ReportedMessage(ReportedMessageInternal {
        reports: vec![MessageReport {
            reported_by: random_principal(),
            timestamp: random(),
            reason_code: random(),
            notes: Some(random_string()),
        }],
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(
        test_deserialization(&bytes),
        MessageContentInternal::ReportedMessage(_)
    ));
    assert!(matches!(
        test_deserialization(REPORTED_MESSAGE),
        MessageContentInternal::ReportedMessage(_)
    ));
}

#[test]
fn p2p_swap_content() {
    let content = MessageContentInternal::P2PSwap(P2PSwapContentInternal {
        swap_id: random(),
        token0: TokenInfo {
            token: Cryptocurrency::CHAT,
            ledger: random_principal(),
            decimals: random(),
            fee: random(),
        },
        token0_amount: random(),
        token1: TokenInfo {
            token: Cryptocurrency::Other(random_string()),
            ledger: random_principal(),
            decimals: random(),
            fee: random(),
        },
        token1_amount: random(),
        expires_at: random(),
        caption: Some(random_string()),
        token0_txn_in: random(),
        status: P2PSwapStatus::Completed(P2PSwapCompleted {
            accepted_by: random_principal(),
            token1_txn_in: random(),
            token0_txn_out: random(),
            token1_txn_out: random(),
        }),
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::P2PSwap(_)));
    assert!(matches!(test_deserialization(P2P_SWAP), MessageContentInternal::P2PSwap(_)));
}

#[test]
fn video_call_content() {
    let content = MessageContentInternal::VideoCall(VideoCallContentInternal {
        call_type: VideoCallType::Broadcast,
        ended: Some(random()),
        participants: [
            (
                random_principal(),
                CallParticipantInternal {
                    joined: random(),
                    last_updated: Some(random()),
                    presence: VideoCallPresence::Owner,
                },
            ),
            (
                random_principal(),
                CallParticipantInternal {
                    joined: random(),
                    last_updated: Some(random()),
                    presence: VideoCallPresence::Default,
                },
            ),
            (
                random_principal(),
                CallParticipantInternal {
                    joined: random(),
                    last_updated: Some(random()),
                    presence: VideoCallPresence::Hidden,
                },
            ),
        ]
        .into_iter()
        .collect(),
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::VideoCall(_)));
    assert!(matches!(
        test_deserialization(VIDEO_CALL),
        MessageContentInternal::VideoCall(_)
    ));
}

#[test]
fn custom_content() {
    let content = MessageContentInternal::Custom(CustomContentInternal {
        kind: random_string(),
        data: random::<[u8; 32]>().to_vec(),
    });
    let bytes = generate_then_serialize_value(content);
    assert!(matches!(test_deserialization(&bytes), MessageContentInternal::Custom(_)));
    assert!(matches!(test_deserialization(CUSTOM), MessageContentInternal::Custom(_)));
}

fn test_deserialization(bytes: &[u8]) -> MessageContentInternal {
    let value = Value::from_bytes(Cow::Borrowed(bytes));
    assert!(value.0.index > EventIndex::default());
    if let ChatEventInternal::Message(m) = value.0.event {
        m.content
    } else {
        panic!("{:?}", value.0);
    }
}

fn generate_then_serialize_value(content: MessageContentInternal) -> Vec<u8> {
    generate_value(content).to_bytes().to_vec()
}

fn generate_value(content: MessageContentInternal) -> Value {
    EventWrapperInternal {
        index: random_u32(),
        timestamp: random(),
        expires_at: Some(random()),
        correlation_id: random(),
        event: ChatEventInternal::Message(Box::new(MessageInternal {
            message_index: random_u32(),
            message_id: random_u128(),
            sender: random_principal(),
            content,
            replies_to: Some(ReplyContextInternal {
                event_index: random_u32(),
                chat_if_other: Some((ChatInternal::Channel(random_principal(), random()), Some(random_u32()))),
            }),
            reactions: vec![(
                Reaction::new(random_string()),
                [random_principal(), random_principal(), random_principal()]
                    .into_iter()
                    .collect(),
            )],
            tips: Tips::new(vec![(
                random_principal(),
                vec![(random_principal(), random_u128()), (random_principal(), random_u128())],
            )]),
            last_edited: Some(random()),
            deleted_by: Some(DeletedByInternal {
                deleted_by: random_principal(),
                timestamp: random(),
            }),
            thread_summary: Some(ThreadSummaryInternal {
                participant_ids: vec![random_principal(), random_principal(), random_principal()],
                follower_ids: [(random_principal(), Timestamped::new(true, random()))].into_iter().collect(),
                reply_count: random(),
                latest_event_index: random_u32(),
                latest_event_timestamp: random(),
            }),
            forwarded: true,
            block_level_markdown: true,
        })),
    }
    .into()
}
