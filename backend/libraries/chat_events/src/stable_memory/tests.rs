#![allow(deprecated)]
use crate::message_content_internal::icrc1::AccountInternal;
use crate::stable_memory::tests::test_values::{
    AUDIO_CURRENT, AUDIO_PREV1, CRYPTO_CURRENT, CRYPTO_PREV1, CUSTOM_CURRENT, CUSTOM_PREV1, DELETED_CURRENT, DELETED_PREV1,
    FILE_CURRENT, FILE_PREV1, GIPHY_CURRENT, GIPHY_PREV1, GOVERNANCE_PROPOSAL_CURRENT, GOVERNANCE_PROPOSAL_PREV1,
    IMAGE_CURRENT, IMAGE_PREV1, MESSAGE_REMINDER_CREATED_CURRENT, MESSAGE_REMINDER_CREATED_PREV1, MESSAGE_REMINDER_CURRENT,
    MESSAGE_REMINDER_PREV1, P2P_SWAP_CURRENT, P2P_SWAP_PREV1, POLL_CURRENT, POLL_PREV1, PRIZE_CURRENT, PRIZE_PREV1,
    PRIZE_WINNER_CURRENT, PRIZE_WINNER_PREV1, REPORTED_MESSAGE_CURRENT, REPORTED_MESSAGE_PREV1, TEXT_CURRENT, TEXT_PREV1,
    VIDEO_CALL_CURRENT, VIDEO_CALL_PREV1, VIDEO_CURRENT, VIDEO_PREV1,
};
use crate::stable_memory::{bytes_to_event, event_to_bytes};
use crate::{
    AudioContentInternal, BlobReferenceInternal, CallParticipantInternal, ChatEventInternal, ChatInternal,
    CompletedCryptoTransactionInternal, CryptoContentInternal, CustomContentInternal, DeletedByInternal, FileContentInternal,
    GiphyContentInternal, GiphyImageVariantInternal, ImageContentInternal, MessageContentInternal, MessageInternal,
    MessageReminderContentInternal, MessageReminderCreatedContentInternal, P2PSwapContentInternal, PollConfigInternal,
    PollContentInternal, PrizeContentInternal, PrizeWinnerContentInternal, ProposalContentInternal, ReplyContextInternal,
    ReportedMessageInternal, TextContentInternal, ThreadSummaryInternal, VideoCallContentInternal, VideoContentInternal,
};
use constants::CHAT_SYMBOL;
use rand::rngs::StdRng;
use rand::{Rng, RngCore, SeedableRng};
use testing::rng::deterministic::{random_from_principal, random_from_u128, random_from_u32, random_principal, random_string};
use types::{
    Cryptocurrency, EventIndex, EventWrapperInternal, MessageReport, P2PSwapCompleted, P2PSwapStatus, Proposal,
    ProposalDecisionStatus, ProposalRewardStatus, Reaction, SnsProposal, Tally, ThumbnailData, Tips, TokenInfo,
    VideoCallPresence, VideoCallType,
};

mod test_values;

#[test]
fn text_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::Text(TextContentInternal {
        text: random_string(&mut rng),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, TEXT_CURRENT);

    for test in [TEXT_CURRENT, TEXT_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Text(_)));
    }
}

#[test]
fn image_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::Image(ImageContentInternal {
        width: rng.next_u32(),
        height: rng.next_u32(),
        thumbnail_data: ThumbnailData(random_string(&mut rng)),
        caption: Some(random_string(&mut rng)),
        mime_type: random_string(&mut rng),
        blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(&mut rng),
            blob_id: rng.gen(),
        }),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, IMAGE_CURRENT);

    for test in [IMAGE_CURRENT, IMAGE_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Image(_)));
    }
}

#[test]
fn video_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::Video(VideoContentInternal {
        width: rng.next_u32(),
        height: rng.next_u32(),
        thumbnail_data: ThumbnailData(random_string(&mut rng)),
        caption: Some(random_string(&mut rng)),
        mime_type: random_string(&mut rng),
        image_blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(&mut rng),
            blob_id: rng.gen(),
        }),
        video_blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(&mut rng),
            blob_id: rng.gen(),
        }),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, VIDEO_CURRENT);

    for test in [VIDEO_CURRENT, VIDEO_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Video(_)));
    }
}

#[test]
fn audio_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::Audio(AudioContentInternal {
        caption: Some(random_string(&mut rng)),
        mime_type: random_string(&mut rng),
        blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(&mut rng),
            blob_id: rng.gen(),
        }),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, AUDIO_CURRENT);

    for test in [AUDIO_CURRENT, AUDIO_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Audio(_)));
    }
}

#[test]
fn file_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::File(FileContentInternal {
        name: random_string(&mut rng),
        caption: Some(random_string(&mut rng)),
        mime_type: random_string(&mut rng),
        file_size: rng.gen(),
        blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(&mut rng),
            blob_id: rng.gen(),
        }),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, FILE_CURRENT);

    for test in [FILE_CURRENT, FILE_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::File(_)));
    }
}

#[test]
fn poll_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::Poll(PollContentInternal {
        config: PollConfigInternal {
            text: Some(random_string(&mut rng)),
            options: vec![random_string(&mut rng), random_string(&mut rng), random_string(&mut rng)],
            end_date: Some(rng.gen()),
            anonymous: true,
            show_votes_before_end_date: true,
            allow_multiple_votes_per_user: true,
            allow_user_to_change_vote: true,
        },
        votes: [(
            rng.gen(),
            vec![random_from_principal(&mut rng), random_from_principal(&mut rng)],
        )]
        .into_iter()
        .collect(),
        ended: true,
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, POLL_CURRENT);

    for test in [POLL_CURRENT, POLL_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Poll(_)));
    }
}

#[test]
fn crypto_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::Crypto(CryptoContentInternal {
        recipient: random_from_principal(&mut rng),
        transfer: CompletedCryptoTransactionInternal::ICRC1(crate::icrc1::CompletedCryptoTransactionInternal {
            ledger: random_principal(&mut rng),
            token: CHAT_SYMBOL.to_string().into(),
            amount: rng.gen(),
            from: crate::icrc1::CryptoAccountInternal::Account(AccountInternal {
                owner: random_principal(&mut rng),
                subaccount: Some(rng.gen()),
            }),
            to: crate::icrc1::CryptoAccountInternal::Account(AccountInternal {
                owner: random_principal(&mut rng),
                subaccount: Some(rng.gen()),
            }),
            fee: rng.gen(),
            memo: Some(random_from_u128::<_, u128>(&mut rng).to_be_bytes().to_vec().into()),
            created: rng.gen(),
            block_index: rng.gen(),
        }),
        caption: Some(random_string(&mut rng)),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, CRYPTO_CURRENT);

    for test in [CRYPTO_CURRENT, CRYPTO_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Crypto(_)));
    }
}

#[test]
fn deleted_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::Deleted(DeletedByInternal {
        deleted_by: random_from_principal(&mut rng),
        timestamp: rng.gen(),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, DELETED_CURRENT);

    for test in [DELETED_CURRENT, DELETED_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Deleted(_)));
    }
}

#[test]
fn giphy_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::Giphy(GiphyContentInternal {
        caption: Some(random_string(&mut rng)),
        title: random_string(&mut rng),
        desktop: GiphyImageVariantInternal {
            width: rng.gen(),
            height: rng.gen(),
            url: random_string(&mut rng),
            mime_type: random_string(&mut rng),
        },
        mobile: GiphyImageVariantInternal {
            width: rng.gen(),
            height: rng.gen(),
            url: random_string(&mut rng),
            mime_type: random_string(&mut rng),
        },
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, GIPHY_CURRENT);

    for test in [GIPHY_CURRENT, GIPHY_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Giphy(_)));
    }
}

#[test]
fn governance_proposal() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::GovernanceProposal(ProposalContentInternal {
        governance_canister_id: random_principal(&mut rng),
        proposal: Proposal::SNS(SnsProposal {
            id: rng.gen(),
            action: rng.gen(),
            proposer: rng.gen(),
            created: rng.gen(),
            title: random_string(&mut rng),
            summary: random_string(&mut rng),
            url: random_string(&mut rng),
            status: ProposalDecisionStatus::Executed,
            reward_status: ProposalRewardStatus::Settled,
            tally: Tally {
                yes: rng.gen(),
                no: rng.gen(),
                total: rng.gen(),
                timestamp: rng.gen(),
            },
            deadline: rng.gen(),
            payload_text_rendering: Some(random_string(&mut rng)),
            minimum_yes_proportion_of_total: rng.gen(),
            minimum_yes_proportion_of_exercised: rng.gen(),
            last_updated: rng.gen(),
        }),
        votes: [
            (random_from_principal(&mut rng), true),
            (random_from_principal(&mut rng), false),
        ]
        .into_iter()
        .collect(),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, GOVERNANCE_PROPOSAL_CURRENT);

    for test in [GOVERNANCE_PROPOSAL_CURRENT, GOVERNANCE_PROPOSAL_PREV1] {
        assert!(matches!(
            test_deserialization(test),
            MessageContentInternal::GovernanceProposal(_)
        ));
    }
}

#[test]
fn prize_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::Prize(PrizeContentInternal {
        prizes_remaining: vec![rng.gen(), rng.gen(), rng.gen()],
        reservations: [
            random_from_principal(&mut rng),
            random_from_principal(&mut rng),
            random_from_principal(&mut rng),
        ]
        .into_iter()
        .collect(),
        winners: [
            random_from_principal(&mut rng),
            random_from_principal(&mut rng),
            random_from_principal(&mut rng),
        ]
        .into_iter()
        .collect(),
        transaction: CompletedCryptoTransactionInternal::NNS(crate::nns::CompletedCryptoTransactionInternal {
            ledger: random_principal(&mut rng),
            token: CHAT_SYMBOL.to_string().into(),
            amount: rng.gen(),
            fee: rng.gen(),
            from: crate::nns::CryptoAccountInternal::Account(rng.gen::<[u8; 28]>().try_into().unwrap()),
            to: crate::nns::CryptoAccountInternal::Account(rng.gen::<[u8; 28]>().try_into().unwrap()),
            memo: rng.gen(),
            created: rng.gen(),
            transaction_hash: rng.gen(),
            block_index: rng.gen(),
        }),
        end_date: rng.gen(),
        caption: Some(random_string(&mut rng)),
        diamond_only: true,
        lifetime_diamond_only: false,
        unique_person_only: false,
        streak_only: 0,
        final_payments_started: true,
        ledger_error: true,
        prizes_paid: 0,
        fee_percent: 0,
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, PRIZE_CURRENT);

    for test in [PRIZE_CURRENT, PRIZE_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Prize(_)));
    }
}

#[test]
fn prize_winner_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::PrizeWinner(PrizeWinnerContentInternal {
        winner: random_from_principal(&mut rng),
        ledger: random_principal(&mut rng),
        token_symbol: random_string(&mut rng),
        amount: rng.gen(),
        fee: rng.gen(),
        block_index: rng.gen(),
        prize_message: random_from_u32(&mut rng),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, PRIZE_WINNER_CURRENT);

    for test in [PRIZE_WINNER_CURRENT, PRIZE_WINNER_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::PrizeWinner(_)));
    }
}

#[test]
fn message_reminder_created_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::MessageReminderCreated(MessageReminderCreatedContentInternal {
        reminder_id: rng.gen(),
        remind_at: rng.gen(),
        notes: Some(random_string(&mut rng)),
        hidden: rng.gen(),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, MESSAGE_REMINDER_CREATED_CURRENT);

    for test in [MESSAGE_REMINDER_CREATED_CURRENT, MESSAGE_REMINDER_CREATED_PREV1] {
        assert!(matches!(
            test_deserialization(test),
            MessageContentInternal::MessageReminderCreated(_)
        ));
    }
}

#[test]
fn message_reminder_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::MessageReminder(MessageReminderContentInternal {
        reminder_id: rng.gen(),
        notes: Some(random_string(&mut rng)),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, MESSAGE_REMINDER_CURRENT);

    for test in [MESSAGE_REMINDER_CURRENT, MESSAGE_REMINDER_PREV1] {
        assert!(matches!(
            test_deserialization(test),
            MessageContentInternal::MessageReminder(_)
        ));
    }
}

#[test]
fn reported_message_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::ReportedMessage(ReportedMessageInternal {
        reports: vec![MessageReport {
            reported_by: random_from_principal(&mut rng),
            timestamp: rng.gen(),
            reason_code: rng.gen(),
            notes: Some(random_string(&mut rng)),
        }],
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, REPORTED_MESSAGE_CURRENT);

    for test in [REPORTED_MESSAGE_CURRENT, REPORTED_MESSAGE_PREV1] {
        assert!(matches!(
            test_deserialization(test),
            MessageContentInternal::ReportedMessage(_)
        ));
    }
}

#[test]
fn p2p_swap_content() {
    let mut rng = get_fresh_rng();
    let symbol = random_string(&mut rng);
    let content = MessageContentInternal::P2PSwap(P2PSwapContentInternal {
        swap_id: rng.gen(),
        token0: TokenInfo {
            symbol: CHAT_SYMBOL.to_string(),
            token: Cryptocurrency::CHAT,
            ledger: random_principal(&mut rng),
            decimals: rng.gen(),
            fee: rng.gen(),
        },
        token0_amount: rng.gen(),
        token1: TokenInfo {
            symbol: symbol.clone(),
            token: Cryptocurrency::Other(symbol),
            ledger: random_principal(&mut rng),
            decimals: rng.gen(),
            fee: rng.gen(),
        },
        token1_amount: rng.gen(),
        expires_at: rng.next_u64(),
        caption: Some(random_string(&mut rng)),
        token0_txn_in: rng.next_u64(),
        status: P2PSwapStatus::Completed(P2PSwapCompleted {
            accepted_by: random_from_principal(&mut rng),
            token1_txn_in: rng.next_u64(),
            token0_txn_out: rng.next_u64(),
            token1_txn_out: rng.next_u64(),
        }),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, P2P_SWAP_CURRENT);

    for test in [P2P_SWAP_CURRENT, P2P_SWAP_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::P2PSwap(_)));
    }
}

#[test]
fn video_call_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::VideoCall(VideoCallContentInternal {
        call_type: VideoCallType::Broadcast,
        ended: Some(rng.next_u64()),
        participants: [
            (
                random_from_principal(&mut rng),
                CallParticipantInternal {
                    joined: rng.next_u64(),
                    last_updated: Some(rng.next_u64()),
                    presence: VideoCallPresence::Owner,
                },
            ),
            (
                random_from_principal(&mut rng),
                CallParticipantInternal {
                    joined: rng.next_u64(),
                    last_updated: Some(rng.next_u64()),
                    presence: VideoCallPresence::Default,
                },
            ),
            (
                random_from_principal(&mut rng),
                CallParticipantInternal {
                    joined: rng.next_u64(),
                    last_updated: Some(rng.next_u64()),
                    presence: VideoCallPresence::Hidden,
                },
            ),
        ]
        .into_iter()
        .collect(),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, VIDEO_CALL_CURRENT);

    for test in [VIDEO_CALL_CURRENT, VIDEO_CALL_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::VideoCall(_)));
    }
}

#[test]
fn custom_content() {
    let mut rng = get_fresh_rng();
    let content = MessageContentInternal::Custom(CustomContentInternal {
        kind: random_string(&mut rng),
        data: rng.gen::<[u8; 32]>().to_vec(),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, CUSTOM_CURRENT);

    for test in [CUSTOM_CURRENT, CUSTOM_PREV1] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Custom(_)));
    }
}

fn test_deserialization(bytes: &[u8]) -> MessageContentInternal {
    let value = bytes_to_event(bytes);
    assert!(value.index > EventIndex::default());
    if let ChatEventInternal::Message(m) = value.event {
        m.content
    } else {
        panic!("{:?}", value);
    }
}

fn generate_then_serialize_value<R: RngCore>(content: MessageContentInternal, rng: &mut R) -> Vec<u8> {
    event_to_bytes(generate_value(content, rng))
}

fn generate_value<R: RngCore>(content: MessageContentInternal, rng: &mut R) -> EventWrapperInternal<ChatEventInternal> {
    EventWrapperInternal {
        index: random_from_u32(rng),
        timestamp: rng.gen(),
        expires_at: Some(rng.gen()),
        correlation_id: rng.gen(),
        event: ChatEventInternal::Message(Box::new(MessageInternal {
            message_index: random_from_u32(rng),
            message_id: random_from_u128(rng),
            sender: random_from_principal(rng),
            content,
            replies_to: Some(ReplyContextInternal {
                event_index: random_from_u32(rng),
                chat_if_other: Some((
                    ChatInternal::Channel(random_from_principal(rng), random_from_u32(rng)),
                    Some(random_from_u32(rng)),
                )),
            }),
            reactions: vec![(
                Reaction::new(random_string(rng)),
                [
                    random_from_principal(rng),
                    random_from_principal(rng),
                    random_from_principal(rng),
                ]
                .into_iter()
                .collect(),
            )],
            tips: Tips::new(vec![(
                random_principal(rng),
                vec![
                    (random_from_principal(rng), random_from_u128(rng)),
                    (random_from_principal(rng), random_from_u128(rng)),
                ],
            )]),
            last_edited: Some(rng.gen()),
            deleted_by: Some(DeletedByInternal {
                deleted_by: random_from_principal(rng),
                timestamp: rng.gen(),
            }),
            thread_summary: Some(ThreadSummaryInternal {
                participants: vec![
                    random_from_principal(rng),
                    random_from_principal(rng),
                    random_from_principal(rng),
                ],
                followers: [random_from_principal(rng), random_from_principal(rng)].into_iter().collect(),
                reply_count: rng.gen(),
                latest_event_index: random_from_u32(rng),
                latest_event_timestamp: rng.gen(),
            }),
            forwarded: true,
            block_level_markdown: true,
            bot_context: None,
        })),
    }
}

fn get_fresh_rng() -> StdRng {
    let seed = [0; 32];
    StdRng::from_seed(seed)
}
