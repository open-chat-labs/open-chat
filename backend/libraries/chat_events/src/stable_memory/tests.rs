use crate::EventsMap;
use crate::message_content_internal::icrc1::AccountInternal;
use crate::stable_memory::tests::test_values::{
    AUDIO_CURRENT, AUDIO_PREV1, AUDIO_PREV2, AUDIO_PREV3, CRYPTO_CURRENT, CRYPTO_PREV1, CRYPTO_PREV2, CRYPTO_PREV3,
    CUSTOM_CURRENT, CUSTOM_PREV1, CUSTOM_PREV2, DELETED_CURRENT, DELETED_PREV1, DELETED_PREV2, FILE_CURRENT, FILE_PREV1,
    FILE_PREV2, GIPHY_CURRENT, GIPHY_PREV1, GIPHY_PREV2, GOVERNANCE_PROPOSAL_CURRENT, GOVERNANCE_PROPOSAL_PREV1,
    GOVERNANCE_PROPOSAL_PREV2, IMAGE_CURRENT, IMAGE_PREV1, IMAGE_PREV2, MESSAGE_REMINDER_CREATED_CURRENT,
    MESSAGE_REMINDER_CREATED_PREV1, MESSAGE_REMINDER_CREATED_PREV2, MESSAGE_REMINDER_CURRENT, MESSAGE_REMINDER_PREV1,
    MESSAGE_REMINDER_PREV2, P2P_SWAP_CURRENT, P2P_SWAP_PREV1, P2P_SWAP_PREV2, P2P_SWAP_PREV3, POLL_CURRENT, POLL_PREV1,
    POLL_PREV2, PRIZE_CURRENT, PRIZE_PREV1, PRIZE_PREV2, PRIZE_PREV3, PRIZE_PREV4, PRIZE_PREV5, PRIZE_PREV6,
    PRIZE_WINNER_CURRENT, PRIZE_WINNER_PREV1, PRIZE_WINNER_PREV2, REPORTED_MESSAGE_CURRENT, REPORTED_MESSAGE_PREV1,
    REPORTED_MESSAGE_PREV2, TEXT_CURRENT, TEXT_PREV1, TEXT_PREV2, VIDEO_CALL_CURRENT, VIDEO_CALL_PREV1, VIDEO_CALL_PREV2,
    VIDEO_CURRENT, VIDEO_PREV1, VIDEO_PREV2,
};
use crate::stable_memory::{ChatEventsStableStorage, bytes_to_event, event_to_bytes};
use crate::{
    AudioContentInternal, BlobReferenceInternal, CallParticipantInternal, ChatEventInternal, ChatInternal,
    CompletedCryptoTransactionInternal, CryptoContentInternal, CustomContentInternal, DeletedByInternal, FileContentInternal,
    GiphyContentInternal, GiphyImageVariantInternal, ImageContentInternal, MessageContentInternal, MessageInternal,
    MessageReminderContentInternal, MessageReminderCreatedContentInternal, P2PSwapContentInternal, PollConfigInternal,
    PollContentInternal, PrizeContentInternal, PrizeWinnerContentInternal, ProposalContentInternal, ReplyContextInternal,
    ReportedMessageInternal, TextContentInternal, ThreadSummaryInternal, VideoCallContentInternal, VideoContentInternal,
};
use candid::Principal;
use constants::CHAT_SYMBOL;
use ic_stable_structures::DefaultMemoryImpl;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
use rand::rngs::StdRng;
use rand::{Rng, RngExt, SeedableRng};
use stable_memory_map::{ChatEventKeyPrefix, Key, KeyPrefix, with_map};
use testing::rng::deterministic::{random_from_principal, random_from_u32, random_from_u128, random_principal, random_string};
use types::{
    CallKind, EventIndex, EventWrapperInternal, MessageReport, P2PSwapCompleted, P2PSwapStatus, Proposal,
    ProposalDecisionStatus, ProposalRewardStatus, Reaction, SnsProposal, Tally, ThumbnailData, Tips, TokenInfo,
    VideoCallPresence,
};

mod test_values;

#[test]
fn text_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::Text(TextContentInternal {
        text: random_string(&mut rng),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, TEXT_CURRENT);

    for test in [TEXT_CURRENT, TEXT_PREV1, TEXT_PREV2] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Text(_)));
    }
}

#[test]
fn image_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::Image(ImageContentInternal {
        width: rng.next_u32(),
        height: rng.next_u32(),
        thumbnail_data: ThumbnailData(random_string(&mut rng)),
        caption: Some(random_string(&mut rng)),
        mime_type: random_string(&mut rng),
        blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(&mut rng),
            blob_id: rng.random(),
        }),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, IMAGE_CURRENT);

    for test in [IMAGE_CURRENT, IMAGE_PREV1, IMAGE_PREV2] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Image(_)));
    }
}

#[test]
fn video_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::Video(VideoContentInternal {
        width: rng.next_u32(),
        height: rng.next_u32(),
        thumbnail_data: ThumbnailData(random_string(&mut rng)),
        caption: Some(random_string(&mut rng)),
        mime_type: random_string(&mut rng),
        image_blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(&mut rng),
            blob_id: rng.random(),
        }),
        video_blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(&mut rng),
            blob_id: rng.random(),
        }),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, VIDEO_CURRENT);

    for test in [VIDEO_CURRENT, VIDEO_PREV1, VIDEO_PREV2] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Video(_)));
    }
}

#[test]
fn audio_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::Audio(AudioContentInternal {
        caption: Some(random_string(&mut rng)),
        mime_type: random_string(&mut rng),
        blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(&mut rng),
            blob_id: rng.random(),
        }),
        duration_ms: rng.random(),
        samples: rng.random::<[u8; 32]>().to_vec(),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, AUDIO_CURRENT);

    for test in [AUDIO_CURRENT, AUDIO_PREV1, AUDIO_PREV2, AUDIO_PREV3] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Audio(_)));
    }
}

#[test]
fn file_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::File(FileContentInternal {
        name: random_string(&mut rng),
        caption: Some(random_string(&mut rng)),
        mime_type: random_string(&mut rng),
        file_size: rng.random(),
        blob_reference: Some(BlobReferenceInternal {
            canister_id: random_principal(&mut rng),
            blob_id: rng.random(),
        }),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, FILE_CURRENT);

    for test in [FILE_CURRENT, FILE_PREV1, FILE_PREV2] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::File(_)));
    }
}

#[test]
fn poll_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::Poll(PollContentInternal {
        config: PollConfigInternal {
            text: Some(random_string(&mut rng)),
            options: vec![random_string(&mut rng), random_string(&mut rng), random_string(&mut rng)],
            end_date: Some(rng.random()),
            anonymous: true,
            show_votes_before_end_date: true,
            allow_multiple_votes_per_user: true,
            allow_user_to_change_vote: true,
        },
        votes: [(
            rng.random(),
            vec![random_from_principal(&mut rng), random_from_principal(&mut rng)],
        )]
        .into_iter()
        .collect(),
        ended: true,
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, POLL_CURRENT);

    for test in [POLL_CURRENT, POLL_PREV1, POLL_PREV2] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Poll(_)));
    }
}

#[test]
fn crypto_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::Crypto(CryptoContentInternal {
        recipient: random_from_principal(&mut rng),
        transfer: CompletedCryptoTransactionInternal::ICRC1(crate::icrc1::CompletedCryptoTransactionInternal {
            ledger: random_principal(&mut rng),
            token_symbol: CHAT_SYMBOL.to_string(),
            amount: rng.random(),
            from: crate::icrc1::CryptoAccountInternal::Account(AccountInternal {
                owner: random_principal(&mut rng),
                subaccount: Some(rng.random()),
            }),
            to: crate::icrc1::CryptoAccountInternal::Account(AccountInternal {
                owner: random_principal(&mut rng),
                subaccount: Some(rng.random()),
            }),
            fee: rng.random(),
            memo: Some(random_from_u128::<_, u128>(&mut rng).to_be_bytes().to_vec().into()),
            created: rng.random(),
            block_index: rng.random(),
        }),
        caption: Some(random_string(&mut rng)),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, CRYPTO_CURRENT);

    for test in [CRYPTO_CURRENT, CRYPTO_PREV1, CRYPTO_PREV2, CRYPTO_PREV3] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Crypto(_)));
    }
}

#[test]
fn deleted_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::Deleted(DeletedByInternal {
        deleted_by: random_from_principal(&mut rng),
        timestamp: rng.random(),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, DELETED_CURRENT);

    for test in [DELETED_CURRENT, DELETED_PREV1, DELETED_PREV2] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Deleted(_)));
    }
}

#[test]
fn giphy_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::Giphy(GiphyContentInternal {
        caption: Some(random_string(&mut rng)),
        title: random_string(&mut rng),
        desktop: GiphyImageVariantInternal {
            width: rng.random(),
            height: rng.random(),
            url: random_string(&mut rng),
            mime_type: random_string(&mut rng),
        },
        mobile: GiphyImageVariantInternal {
            width: rng.random(),
            height: rng.random(),
            url: random_string(&mut rng),
            mime_type: random_string(&mut rng),
        },
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, GIPHY_CURRENT);

    for test in [GIPHY_CURRENT, GIPHY_PREV1, GIPHY_PREV2] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Giphy(_)));
    }
}

#[test]
fn governance_proposal() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::GovernanceProposal(ProposalContentInternal {
        governance_canister_id: random_principal(&mut rng),
        proposal: Proposal::SNS(SnsProposal {
            id: rng.random(),
            action: rng.random(),
            proposer: rng.random(),
            created: rng.random(),
            title: random_string(&mut rng),
            summary: random_string(&mut rng),
            url: random_string(&mut rng),
            status: ProposalDecisionStatus::Executed,
            reward_status: ProposalRewardStatus::Settled,
            tally: Tally {
                yes: rng.random(),
                no: rng.random(),
                total: rng.random(),
                timestamp: rng.random(),
            },
            deadline: rng.random(),
            payload_text_rendering: Some(random_string(&mut rng)),
            minimum_yes_proportion_of_total: rng.random(),
            minimum_yes_proportion_of_exercised: rng.random(),
            last_updated: rng.random(),
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

    for test in [
        GOVERNANCE_PROPOSAL_CURRENT,
        GOVERNANCE_PROPOSAL_PREV1,
        GOVERNANCE_PROPOSAL_PREV2,
    ] {
        assert!(matches!(
            test_deserialization(test),
            MessageContentInternal::GovernanceProposal(_)
        ));
    }
}

#[test]
fn prize_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::Prize(PrizeContentInternal {
        prizes_remaining: vec![rng.random(), rng.random(), rng.random()],
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
            token_symbol: CHAT_SYMBOL.to_string(),
            amount: rng.random(),
            fee: rng.random(),
            from: crate::nns::CryptoAccountInternal::Account(rng.random::<[u8; 28]>().try_into().unwrap()),
            to: crate::nns::CryptoAccountInternal::Account(rng.random::<[u8; 28]>().try_into().unwrap()),
            memo: rng.random(),
            created: rng.random(),
            transaction_hash: rng.random(),
            block_index: rng.random(),
        }),
        end_date: rng.random(),
        caption: Some(random_string(&mut rng)),
        diamond_only: true,
        lifetime_diamond_only: true,
        unique_person_only: true,
        streak_only: 100,
        final_payments_started: true,
        ledger_error: true,
        prizes_paid: 10,
        fee_percent: 5,
        requires_captcha: true,
        min_chit_earned: 100,
        principal: random_principal(&mut rng),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, PRIZE_CURRENT);

    for test in [
        PRIZE_CURRENT,
        PRIZE_PREV1,
        PRIZE_PREV2,
        PRIZE_PREV3,
        PRIZE_PREV4,
        PRIZE_PREV5,
        PRIZE_PREV6,
    ] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Prize(_)));
    }

    // Prizes stored before the sender's principal was recorded default to anonymous
    let MessageContentInternal::Prize(prize) = test_deserialization(PRIZE_PREV1) else {
        panic!()
    };
    assert_eq!(prize.principal, Principal::anonymous());
}

#[test]
fn prize_winner_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::PrizeWinner(PrizeWinnerContentInternal {
        winner: random_from_principal(&mut rng),
        ledger: random_principal(&mut rng),
        token_symbol: random_string(&mut rng),
        amount: rng.random(),
        fee: rng.random(),
        block_index: rng.random(),
        prize_message: random_from_u32(&mut rng),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, PRIZE_WINNER_CURRENT);

    for test in [PRIZE_WINNER_CURRENT, PRIZE_WINNER_PREV1, PRIZE_WINNER_PREV2] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::PrizeWinner(_)));
    }
}

#[test]
fn message_reminder_created_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::MessageReminderCreated(MessageReminderCreatedContentInternal {
        reminder_id: rng.random(),
        remind_at: rng.random(),
        notes: Some(random_string(&mut rng)),
        hidden: rng.random(),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, MESSAGE_REMINDER_CREATED_CURRENT);

    for test in [
        MESSAGE_REMINDER_CREATED_CURRENT,
        MESSAGE_REMINDER_CREATED_PREV1,
        MESSAGE_REMINDER_CREATED_PREV2,
    ] {
        assert!(matches!(
            test_deserialization(test),
            MessageContentInternal::MessageReminderCreated(_)
        ));
    }
}

#[test]
fn message_reminder_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::MessageReminder(MessageReminderContentInternal {
        reminder_id: rng.random(),
        notes: Some(random_string(&mut rng)),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, MESSAGE_REMINDER_CURRENT);

    for test in [MESSAGE_REMINDER_CURRENT, MESSAGE_REMINDER_PREV1, MESSAGE_REMINDER_PREV2] {
        assert!(matches!(
            test_deserialization(test),
            MessageContentInternal::MessageReminder(_)
        ));
    }
}

#[test]
fn reported_message_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::ReportedMessage(ReportedMessageInternal {
        reports: vec![MessageReport {
            reported_by: random_from_principal(&mut rng),
            timestamp: rng.random(),
            reason_code: rng.random(),
            notes: Some(random_string(&mut rng)),
        }],
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, REPORTED_MESSAGE_CURRENT);

    for test in [REPORTED_MESSAGE_CURRENT, REPORTED_MESSAGE_PREV1, REPORTED_MESSAGE_PREV2] {
        assert!(matches!(
            test_deserialization(test),
            MessageContentInternal::ReportedMessage(_)
        ));
    }
}

#[test]
fn p2p_swap_content() {
    let mut rng = get_deterministic_rng();
    let symbol = random_string(&mut rng);
    let content = MessageContentInternal::P2PSwap(P2PSwapContentInternal {
        swap_id: rng.random(),
        token0: TokenInfo {
            symbol: CHAT_SYMBOL.to_string(),
            ledger: random_principal(&mut rng),
            decimals: rng.random(),
            fee: rng.random(),
        },
        token0_amount: rng.random(),
        token1: TokenInfo {
            symbol: symbol.clone(),
            ledger: random_principal(&mut rng),
            decimals: rng.random(),
            fee: rng.random(),
        },
        token1_amount: rng.random(),
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

    for test in [P2P_SWAP_CURRENT, P2P_SWAP_PREV1, P2P_SWAP_PREV2, P2P_SWAP_PREV3] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::P2PSwap(_)));
    }
}

#[test]
fn video_call_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::VideoCall(VideoCallContentInternal {
        call_type: CallKind::Broadcast,
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

    for test in [VIDEO_CALL_CURRENT, VIDEO_CALL_PREV1, VIDEO_CALL_PREV2] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::VideoCall(_)));
    }
}

#[test]
fn custom_content() {
    let mut rng = get_deterministic_rng();
    let content = MessageContentInternal::Custom(CustomContentInternal {
        kind: random_string(&mut rng),
        data: rng.random::<[u8; 32]>().to_vec(),
    });
    let bytes = generate_then_serialize_value(content, &mut rng);
    assert_eq!(bytes, CUSTOM_CURRENT);

    for test in [CUSTOM_CURRENT, CUSTOM_PREV1, CUSTOM_PREV2] {
        assert!(matches!(test_deserialization(test), MessageContentInternal::Custom(_)));
    }
}

fn test_deserialization(bytes: &[u8]) -> MessageContentInternal {
    let value = bytes_to_event(bytes);
    assert!(value.index > EventIndex::default());
    if let ChatEventInternal::Message(m) = value.event {
        m.content
    } else {
        panic!("{value:?}");
    }
}

fn generate_then_serialize_value<R: Rng>(content: MessageContentInternal, rng: &mut R) -> Vec<u8> {
    event_to_bytes(generate_value(content, rng))
}

fn generate_value<R: Rng>(content: MessageContentInternal, rng: &mut R) -> EventWrapperInternal<ChatEventInternal> {
    EventWrapperInternal {
        index: random_from_u32(rng),
        timestamp: rng.random(),
        expires_at: Some(rng.random()),
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
            last_edited: Some(rng.random()),
            deleted_by: Some(DeletedByInternal {
                deleted_by: random_from_principal(rng),
                timestamp: rng.random(),
            }),
            thread_summary: Some(ThreadSummaryInternal {
                participants: vec![
                    random_from_principal(rng),
                    random_from_principal(rng),
                    random_from_principal(rng),
                ],
                followers: [random_from_principal(rng), random_from_principal(rng)].into_iter().collect(),
                reply_count: rng.random(),
                latest_event_index: random_from_u32(rng),
                latest_event_timestamp: rng.random(),
            }),
            forwarded: true,
            block_level_markdown: true,
            sender_context: None,
            og_previews: Vec::new(),
            moderation_flags: 0,
        })),
    }
}

fn get_deterministic_rng() -> StdRng {
    let seed = [0; 32];
    StdRng::from_seed(seed)
}

#[test]
fn legacy_events_stay_readable_while_being_migrated() {
    init_stable_memory_map();
    let legacy_prefix = ChatEventKeyPrefix::new_from_direct_chat_legacy(Principal::from_slice(&[1]).into(), None);
    let new_prefix = ChatEventKeyPrefix::new_from_direct_chat_key_id(5, None);

    // A chat from before `key_id`s were introduced, with gaps where events have been removed
    let mut storage = ChatEventsStableStorage::new(legacy_prefix.clone());
    let count = 250u32;
    for i in 0..count {
        storage.insert(empty_event(i));
    }
    for i in (0..count).step_by(10) {
        storage.remove(i.into());
    }
    let expected: Vec<EventIndex> = (0..count).filter(|i| i % 10 != 0).map(EventIndex::from).collect();

    let check = |storage: &ChatEventsStableStorage| {
        assert_eq!(event_indexes(storage.iter()), expected);
        assert_eq!(event_indexes(storage.iter().rev()), reversed(&expected));
        for (start, end) in [
            (0, 249),
            (50, 150),
            (95, 105),
            (99, 100),
            (100, 100),
            (111, 112),
            (150, 250),
            (200, 200),
            (10, 10),
        ] {
            let expected_range: Vec<_> = expected
                .iter()
                .copied()
                .filter(|i| (start..=end).contains(&u32::from(*i)))
                .collect();
            let inclusive = EventIndex::from(start)..=EventIndex::from(end);
            assert_eq!(
                event_indexes(storage.range(inclusive.clone())),
                expected_range,
                "{start}..={end}"
            );
            assert_eq!(
                event_indexes(storage.range(inclusive).rev()),
                reversed(&expected_range),
                "{start}..={end} rev"
            );
            let expected_range: Vec<_> = expected_range.into_iter().filter(|i| u32::from(*i) < end).collect();
            let exclusive = EventIndex::from(start)..EventIndex::from(end);
            assert_eq!(
                event_indexes(storage.range(exclusive.clone())),
                expected_range,
                "{start}..{end}"
            );
            assert_eq!(
                event_indexes(storage.range(exclusive).rev()),
                reversed(&expected_range),
                "{start}..{end} rev"
            );
        }
        for i in 0..count + 5 {
            let expected = if i < count && i % 10 != 0 { Some(EventIndex::from(i)) } else { None };
            assert_eq!(storage.get(i.into()).map(|e| e.index), expected, "{i}");
        }
    };
    check(&storage);

    storage.assign_key_id_prefix(new_prefix.clone());
    assert!(storage.has_legacy_events());
    assert_eq!(storage.legacy_prefix(), Some(&legacy_prefix));
    assert_eq!(storage.prefix, new_prefix);
    check(&storage);

    // Stop after every batch, checking the events on both sides of the boundary
    let mut rounds = 0;
    while !storage.migrate_legacy_events_batch() {
        rounds += 1;
        assert!(storage.has_legacy_events());
        check(&storage);

        // The state survives being serialized mid-migration
        storage = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&storage));
        assert!(storage.has_legacy_events());
        check(&storage);

        // Inserts and removes go to whichever keys the event is stored under
        let boundary = u32::from(storage.legacy.as_ref().unwrap().migrated_below);
        assert!(boundary > 0 && boundary < count);
        for i in [boundary - 1, boundary].into_iter().filter(|i| i % 10 != 0) {
            assert!(storage.remove(i.into()).is_some());
            assert!(storage.get(i.into()).is_none());
            storage.insert(empty_event(i));
            assert!(storage.get(i.into()).is_some());
        }
        check(&storage);
    }
    assert_eq!(rounds, 2);
    assert!(!storage.has_legacy_events());
    assert_eq!(storage.legacy_prefix(), None);
    check(&storage);

    // Nothing is left under the legacy keys and every event is under the new keys
    assert!(keys_under(&legacy_prefix).is_empty());
    assert_eq!(keys_under(&new_prefix), expected);

    storage = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&storage));
    assert!(!storage.has_legacy_events());
    check(&storage);
}

#[test]
fn legacy_events_are_migrated_in_bounded_batches() {
    init_stable_memory_map();
    let legacy_prefix = ChatEventKeyPrefix::new_from_direct_chat_legacy(Principal::from_slice(&[1]).into(), None);
    let new_prefix = ChatEventKeyPrefix::new_from_direct_chat_key_id(5, None);

    // Exactly 2 full batches, so the final call moves nothing but completes the migration
    let mut storage = ChatEventsStableStorage::new(legacy_prefix.clone());
    for i in 0..200 {
        storage.insert(empty_event(i));
    }
    storage.assign_key_id_prefix(new_prefix.clone());
    for expected_migrated in [100, 200] {
        assert!(!storage.migrate_legacy_events_batch());
        assert_eq!(keys_under(&new_prefix).len(), expected_migrated);
    }
    assert!(storage.has_legacy_events());
    assert!(storage.migrate_legacy_events_batch());
    assert!(!storage.has_legacy_events());
    assert!(keys_under(&legacy_prefix).is_empty());
    assert_eq!(keys_under(&new_prefix).len(), 200);

    // A small list is migrated in a single call
    let small_legacy_prefix = legacy_prefix.for_thread(1.into());
    let small_new_prefix = new_prefix.for_thread(1.into());
    let mut small = ChatEventsStableStorage::new(small_legacy_prefix.clone());
    for i in 0..10 {
        small.insert(empty_event(i));
    }
    small.assign_key_id_prefix(small_new_prefix.clone());
    assert!(small.migrate_legacy_events_batch());
    assert!(!small.has_legacy_events());
    assert!(keys_under(&small_legacy_prefix).is_empty());
    assert_eq!(keys_under(&small_new_prefix).len(), 10);

    // A list with no events completes immediately
    let mut empty = ChatEventsStableStorage::new(legacy_prefix.for_thread(2.into()));
    empty.assign_key_id_prefix(new_prefix.for_thread(2.into()));
    assert!(empty.migrate_legacy_events_batch());
    assert!(!empty.has_legacy_events());
}

fn empty_event(index: u32) -> EventWrapperInternal<ChatEventInternal> {
    EventWrapperInternal {
        index: index.into(),
        timestamp: index as u64,
        expires_at: None,
        event: ChatEventInternal::Empty,
    }
}

fn event_indexes(iter: impl Iterator<Item = EventWrapperInternal<ChatEventInternal>>) -> Vec<EventIndex> {
    iter.map(|e| e.index).collect()
}

fn reversed(indexes: &[EventIndex]) -> Vec<EventIndex> {
    indexes.iter().rev().copied().collect()
}

fn keys_under(prefix: &ChatEventKeyPrefix) -> Vec<EventIndex> {
    with_map(|m| {
        m.range(prefix.create_key(&EventIndex::default())..)
            .take_while(|(k, _)| k.matches_prefix(prefix))
            .map(|(k, _)| k.event_index())
            .collect()
    })
}

fn init_stable_memory_map() {
    let memory = MemoryManager::init(DefaultMemoryImpl::default());
    stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
}
