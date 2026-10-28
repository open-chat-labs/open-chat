use crate::variants::every;
use candid::Principal;
use ic_ledger_types::{AccountIdentifier, Subaccount};
use icrc_ledger_types::icrc1::transfer::Memo;
use num_traits::Bounded;
use serde_bytes::ByteBuf;
use std::collections::HashMap;
use types::{
    AudioContent, AuthorityReportState, BlobReference, CallParticipant, CanisterId, Chat, CompletedCryptoTransaction,
    CryptoContent, CryptoTransaction, CustomContent, DeletedBy, EncryptedContent, EncryptedMessageContentType,
    FailedCryptoTransaction, FileContent, GiphyContent, GiphyImageVariant, ImageContent, MediaScanMatch, MediaScanProvider,
    MessageContent, MessageReminderContent, MessageReminderCreatedContent, MessageReport, MiniAppActive, MiniAppContent,
    MiniAppFinished, MiniAppImage, MiniAppStatus, ModerationReportContent, ModerationReportResolution, ModerationReportStatus,
    NnsProposal, P2PSwapAccepted, P2PSwapCancelled, P2PSwapCompleted, P2PSwapContent, P2PSwapReserved, P2PSwapStatus,
    PendingCryptoTransaction, PollConfig, PollContent, PollVotes, PriceChartContent, PriceChartSeries, PriceChartSource,
    PriceChartToken, PrizeContent, PrizeWinnerContent, Proposal, ProposalContent, ProposalDecisionStatus, ProposalRewardStatus,
    ReportedMessage, SnsProposal, Tally, TextContent, ThumbnailData, TokenInfo, TotalVotes, UserId, VideoCallContent,
    VideoCallType, VideoContent, certified, icrc1, icrc2, nns,
};

/// One value of every kind of content OpenChat sends bots, and of every variant within them, with
/// every `Option` filled in and every list non-empty so that each of their fields is encoded
pub fn message_contents() -> Vec<MessageContent> {
    let mut contents = vec![
        MessageContent::Text(TextContent {
            text: "Hello".to_string(),
        }),
        MessageContent::Image(ImageContent {
            width: max(),
            height: max(),
            thumbnail_data: thumbnail(),
            caption: caption(),
            mime_type: "image/png".to_string(),
            blob_reference: Some(blob_reference()),
        }),
        MessageContent::Video(VideoContent {
            width: max(),
            height: max(),
            thumbnail_data: thumbnail(),
            caption: caption(),
            mime_type: "video/mp4".to_string(),
            image_blob_reference: Some(blob_reference()),
            video_blob_reference: Some(blob_reference()),
        }),
        MessageContent::Audio(AudioContent {
            caption: caption(),
            mime_type: "audio/mpeg".to_string(),
            blob_reference: Some(blob_reference()),
            duration_ms: Some(max()),
            samples: Some(vec![1, 2, 3]),
        }),
        MessageContent::File(FileContent {
            name: "file.pdf".to_string(),
            caption: caption(),
            mime_type: "application/pdf".to_string(),
            file_size: max(),
            blob_reference: Some(blob_reference()),
        }),
        MessageContent::Deleted(DeletedBy {
            deleted_by: user_id(1),
            timestamp: max(),
        }),
        MessageContent::Giphy(GiphyContent {
            caption: caption(),
            title: "Giphy".to_string(),
            desktop: giphy_image_variant(),
            mobile: giphy_image_variant(),
        }),
        MessageContent::Prize(prize()),
        MessageContent::MessageReminderCreated(MessageReminderCreatedContent {
            reminder_id: max(),
            remind_at: max(),
            notes: Some("Notes".to_string()),
            hidden: true,
        }),
        MessageContent::MessageReminder(MessageReminderContent {
            reminder_id: max(),
            notes: Some("Notes".to_string()),
        }),
        MessageContent::ReportedMessage(ReportedMessage {
            reports: vec![MessageReport {
                reported_by: user_id(1),
                timestamp: max(),
                reason_code: max(),
                notes: Some("Notes".to_string()),
            }],
            count: max(),
        }),
        MessageContent::Custom(CustomContent {
            kind: "custom".to_string(),
            data: vec![1, 2, 3],
        }),
        MessageContent::PriceChart(PriceChartContent {
            title: "CHAT and ADA · 30 days".to_string(),
            start: max(),
            end: max(),
            series: vec![
                PriceChartSeries {
                    token: PriceChartToken::Ledger(Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 2, 1, 1])),
                    symbol: "CHAT".to_string(),
                    name: "OpenChat".to_string(),
                    points: vec![(max(), 0.5)],
                },
                PriceChartSeries {
                    token: PriceChartToken::Coin("cardano".to_string()),
                    symbol: "ADA".to_string(),
                    name: "Cardano".to_string(),
                    points: vec![(max(), 0.25)],
                },
            ],
            sources: vec![PriceChartSource {
                name: "CoinGecko".to_string(),
                url: "https://www.coingecko.com".to_string(),
            }],
        }),
    ];

    contents.extend(
        every(vec![
            MiniAppStatus::Open,
            MiniAppStatus::Active(MiniAppActive {
                players: vec![user_id(1), user_id(2)],
                waiting_for: vec![user_id(2)],
            }),
            MiniAppStatus::Finished(MiniAppFinished {
                players: vec![user_id(1), user_id(2)],
                result: Some("Bob won".to_string()),
            }),
        ])
        .into_iter()
        .map(|status| {
            MessageContent::MiniApp(MiniAppContent {
                text: "**Uno** · 2 to 4 players".to_string(),
                image: Some(MiniAppImage {
                    width: max(),
                    height: max(),
                    mime_type: "image/png".to_string(),
                    blob_reference: BlobReference {
                        canister_id: Principal::from_slice(&[1]),
                        blob_id: max(),
                    },
                }),
                max_players: Some(max()),
                spectators: true,
                status,
            })
        }),
    );

    contents.extend(total_votes().into_iter().map(|total| {
        MessageContent::Poll(PollContent {
            config: PollConfig {
                text: Some("Question".to_string()),
                options: vec!["Yes".to_string(), "No".to_string()],
                end_date: Some(max()),
                anonymous: false,
                show_votes_before_end_date: true,
                allow_multiple_votes_per_user: false,
                allow_user_to_change_vote: true,
            },
            votes: PollVotes {
                total,
                user: vec![max()],
            },
            ended: false,
        })
    }));

    contents.extend(crypto_transactions().into_iter().map(|transfer| {
        MessageContent::Crypto(CryptoContent {
            recipient: user_id(2),
            transfer,
            caption: caption(),
        })
    }));

    contents.extend(proposals().into_iter().map(|proposal| {
        MessageContent::GovernanceProposal(ProposalContent {
            governance_canister_id: canister_id(3),
            proposal,
            my_vote: Some(true),
        })
    }));

    contents.extend(completed_transactions().into_iter().map(|transaction| {
        MessageContent::PrizeWinner(PrizeWinnerContent {
            winner: user_id(2),
            transaction,
            prize_message: max::<u32>().into(),
        })
    }));

    contents.extend(moderation_reports().into_iter().map(MessageContent::ModerationReport));

    contents.extend(p2p_swap_statuses().into_iter().map(|status| {
        MessageContent::P2PSwap(P2PSwapContent {
            swap_id: max(),
            token0: token_info("CHAT"),
            token0_amount: max(),
            token1: token_info("ICP"),
            token1_amount: max(),
            expires_at: max(),
            caption: caption(),
            token0_txn_in: max(),
            status,
        })
    }));

    contents.extend(
        every(vec![VideoCallType::Broadcast, VideoCallType::Default])
            .into_iter()
            .map(|call_type| {
                MessageContent::VideoCall(VideoCallContent {
                    call_type,
                    audio_only: true,
                    ended: Some(max()),
                    participants: vec![CallParticipant {
                        user_id: user_id(1),
                        joined: max(),
                    }],
                    hidden_participants: max(),
                })
            }),
    );

    contents.extend(encrypted_message_content_types().into_iter().map(|content_type| {
        MessageContent::Encrypted(EncryptedContent {
            content_type,
            version: max(),
            encrypted_message_key: vec![1, 2, 3].into(),
            public_key: vec![4, 5, 6].into(),
            encrypted_data: vec![7, 8, 9],
        })
    }));

    every(contents)
}

fn total_votes() -> Vec<TotalVotes> {
    every(vec![
        TotalVotes::Visible(HashMap::from([(max(), vec![user_id(1)])])),
        TotalVotes::Anonymous(HashMap::from([(max(), max())])),
        TotalVotes::Hidden(max()),
    ])
}

fn crypto_transactions() -> Vec<CryptoTransaction> {
    every(
        pending_transactions()
            .into_iter()
            .map(CryptoTransaction::Pending)
            .chain(completed_transactions().into_iter().map(CryptoTransaction::Completed))
            .chain(failed_transactions().into_iter().map(CryptoTransaction::Failed))
            .collect(),
    )
}

fn pending_transactions() -> Vec<PendingCryptoTransaction> {
    let mut transactions: Vec<_> = every(vec![nns::UserOrAccount::Account(account_identifier())])
        .into_iter()
        .map(|to| {
            PendingCryptoTransaction::NNS(nns::PendingCryptoTransaction {
                ledger: canister_id(4),
                token_symbol: "ICP".to_string(),
                amount: nns::Tokens::from_e8s(max()),
                to,
                fee: Some(nns::Tokens::from_e8s(max())),
                memo: Some(max()),
                created: max(),
            })
        })
        .collect();

    transactions.push(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
        ledger: canister_id(5),
        token_symbol: "CHAT".to_string(),
        amount: max(),
        to: account(),
        fee: max(),
        memo: Some(memo()),
        created: max(),
    }));
    transactions.push(PendingCryptoTransaction::ICRC2(icrc2::PendingCryptoTransaction {
        ledger: canister_id(5),
        token_symbol: "CHAT".to_string(),
        amount: max(),
        from: account(),
        to: account(),
        fee: max(),
        memo: Some(memo()),
        created: max(),
    }));
    transactions.push(PendingCryptoTransaction::Certified(certified::PendingCryptoTransaction {
        ledger: canister_id(5),
        token_symbol: "CHAT".to_string(),
        amount: max(),
        to: account(),
        fee: max(),
        memo: Some(memo()),
        created: max(),
        call: certified::CertifiedCall {
            arg: vec![1, 2, 3],
            ingress_expiry: max(),
            nonce: Some(ByteBuf::from(vec![4, 5, 6])),
            certificate: vec![7, 8, 9],
        },
    }));

    every(transactions)
}

// One of each kind of transaction from each kind of account
fn completed_transactions() -> Vec<CompletedCryptoTransaction> {
    let nns = nns_crypto_accounts().into_iter().map(|from| {
        CompletedCryptoTransaction::NNS(nns::CompletedCryptoTransaction {
            ledger: canister_id(4),
            token_symbol: "ICP".to_string(),
            amount: nns::Tokens::from_e8s(max()),
            fee: nns::Tokens::from_e8s(max()),
            from,
            to: nns::CryptoAccount::Account(account_identifier()),
            memo: max(),
            created: max(),
            transaction_hash: [1; 32],
            block_index: max(),
        })
    });
    let icrc1 = icrc1_crypto_accounts().into_iter().map(|from| {
        CompletedCryptoTransaction::ICRC1(icrc1::CompletedCryptoTransaction {
            ledger: canister_id(5),
            token_symbol: "CHAT".to_string(),
            amount: max(),
            from,
            to: icrc1::CryptoAccount::Account(account()),
            fee: max(),
            memo: Some(memo()),
            created: max(),
            block_index: max(),
        })
    });
    let icrc2 = icrc1_crypto_accounts().into_iter().map(|from| {
        CompletedCryptoTransaction::ICRC2(icrc2::CompletedCryptoTransaction {
            ledger: canister_id(5),
            token_symbol: "CHAT".to_string(),
            amount: max(),
            spender: user_id(1),
            from,
            to: icrc1::CryptoAccount::Account(account()),
            fee: max(),
            memo: Some(memo()),
            created: max(),
            block_index: max(),
        })
    });

    every(nns.chain(icrc1).chain(icrc2).collect())
}

// One of each kind of transaction from each kind of account
fn failed_transactions() -> Vec<FailedCryptoTransaction> {
    let nns = nns_crypto_accounts().into_iter().map(|from| {
        FailedCryptoTransaction::NNS(nns::FailedCryptoTransaction {
            ledger: canister_id(4),
            token_symbol: "ICP".to_string(),
            amount: nns::Tokens::from_e8s(max()),
            fee: nns::Tokens::from_e8s(max()),
            from,
            to: nns::CryptoAccount::Account(account_identifier()),
            memo: max(),
            created: max(),
            transaction_hash: [1; 32],
            error_message: "Error".to_string(),
        })
    });
    let icrc1 = icrc1_crypto_accounts().into_iter().map(|from| {
        FailedCryptoTransaction::ICRC1(icrc1::FailedCryptoTransaction {
            ledger: canister_id(5),
            token_symbol: "CHAT".to_string(),
            amount: max(),
            fee: max(),
            from,
            to: icrc1::CryptoAccount::Account(account()),
            memo: Some(memo()),
            created: max(),
            error_message: "Error".to_string(),
        })
    });
    let icrc2 = icrc1_crypto_accounts().into_iter().map(|from| {
        FailedCryptoTransaction::ICRC2(icrc2::FailedCryptoTransaction {
            ledger: canister_id(5),
            token_symbol: "CHAT".to_string(),
            amount: max(),
            fee: max(),
            spender: user_id(1),
            from,
            to: icrc1::CryptoAccount::Account(account()),
            memo: Some(memo()),
            created: max(),
            error_message: "Error".to_string(),
        })
    });

    every(nns.chain(icrc1).chain(icrc2).collect())
}

fn nns_crypto_accounts() -> Vec<nns::CryptoAccount> {
    every(vec![
        nns::CryptoAccount::Mint,
        nns::CryptoAccount::Account(account_identifier()),
    ])
}

fn icrc1_crypto_accounts() -> Vec<icrc1::CryptoAccount> {
    every(vec![icrc1::CryptoAccount::Mint, icrc1::CryptoAccount::Account(account())])
}

// An NNS proposal in each status, and an SNS proposal in each reward status
fn proposals() -> Vec<Proposal> {
    let statuses = every(vec![
        ProposalDecisionStatus::Unspecified,
        ProposalDecisionStatus::Open,
        ProposalDecisionStatus::Rejected,
        ProposalDecisionStatus::Adopted,
        ProposalDecisionStatus::Executed,
        ProposalDecisionStatus::Failed,
    ]);
    let reward_statuses = every(vec![
        ProposalRewardStatus::Unspecified,
        ProposalRewardStatus::AcceptVotes,
        ProposalRewardStatus::ReadyToSettle,
        ProposalRewardStatus::Settled,
    ]);

    let nns = statuses.into_iter().map(|status| {
        Proposal::NNS(NnsProposal {
            id: max(),
            topic: min(),
            proposer: max(),
            created: max(),
            title: "Title".to_string(),
            summary: "Summary".to_string(),
            url: "https://example.com".to_string(),
            status,
            reward_status: ProposalRewardStatus::AcceptVotes,
            tally: tally(),
            deadline: max(),
            payload_text_rendering: Some("Payload".to_string()),
            last_updated: max(),
        })
    });
    let sns = reward_statuses.into_iter().map(|reward_status| {
        Proposal::SNS(SnsProposal {
            id: max(),
            action: max(),
            proposer: [1; 32],
            created: max(),
            title: "Title".to_string(),
            summary: "Summary".to_string(),
            url: "https://example.com".to_string(),
            status: ProposalDecisionStatus::Open,
            reward_status,
            tally: tally(),
            deadline: max(),
            payload_text_rendering: Some("Payload".to_string()),
            minimum_yes_proportion_of_total: max(),
            minimum_yes_proportion_of_exercised: max(),
            last_updated: max(),
        })
    });

    every(nns.chain(sns).collect())
}

fn tally() -> Tally {
    Tally {
        yes: max(),
        no: max(),
        total: max(),
        timestamp: max(),
    }
}

// `winners` is deprecated, but OpenChat still sends it
#[allow(deprecated)]
fn prize() -> PrizeContent {
    PrizeContent {
        prizes_remaining: max(),
        prizes_pending: max(),
        winners: vec![user_id(1)],
        winner_count: max(),
        user_is_winner: true,
        token_symbol: "CHAT".to_string(),
        ledger: canister_id(5),
        end_date: max(),
        caption: caption(),
        diamond_only: true,
        lifetime_diamond_only: true,
        unique_person_only: true,
        streak_only: max(),
        requires_captcha: true,
        min_chit_earned: max(),
    }
}

// A report in each chat, then one in each status, then one in each authority report state
fn moderation_reports() -> Vec<ModerationReportContent> {
    let report = ModerationReportContent {
        report_index: Some(max()),
        chat_id: Chat::Group(canister_id(6).into()),
        thread_root_message_index: Some(max::<u32>().into()),
        message_index: max::<u32>().into(),
        message_id: max::<u64>().into(),
        sender: user_id(1),
        reporters: vec![user_id(2)],
        flagged_categories: max(),
        classification_failed: true,
        auto_sanctioned: true,
        content_excerpt: Some("Excerpt".to_string()),
        blob_references: vec![blob_reference()],
        media_matches: every(vec![MediaScanProvider::PhotoDna])
            .into_iter()
            .map(|provider| MediaScanMatch {
                provider,
                blob_id: max(),
                source: "Source".to_string(),
                violations: vec!["Violation".to_string()],
                match_distance: min(),
                match_id: Some("Match".to_string()),
                hash: Some("Hash".to_string()),
            })
            .collect(),
        is_blocked_attempt: true,
        reported_at: max(),
        status: ModerationReportStatus::Pending,
        authority_report: Some(AuthorityReportState::Due { urgent: true }),
    };

    let chats = every(vec![
        Chat::Direct(canister_id(6).into()),
        Chat::Group(canister_id(6).into()),
        Chat::Channel(canister_id(7).into(), max::<u32>().into()),
    ]);
    let resolution = ModerationReportResolution {
        moderator: user_id(2),
        timestamp: max(),
    };
    let statuses = every(vec![
        ModerationReportStatus::Pending,
        ModerationReportStatus::Contested,
        ModerationReportStatus::Upheld(resolution),
        ModerationReportStatus::UpheldAsCsam(resolution),
        ModerationReportStatus::Dismissed(resolution),
    ]);
    let authority_reports = every(vec![
        AuthorityReportState::Due { urgent: true },
        AuthorityReportState::Filed {
            portal_reference: "Reference".to_string(),
        },
        AuthorityReportState::Attempting { started_at: max() },
        AuthorityReportState::ContingencyRequired {
            error: "Error".to_string(),
            urgent: true,
        },
        AuthorityReportState::ValidationFailed {
            error: "Error".to_string(),
            urgent: true,
        },
    ]);

    chats
        .into_iter()
        .map(|chat_id| ModerationReportContent {
            chat_id,
            ..report.clone()
        })
        .chain(statuses.into_iter().map(|status| ModerationReportContent {
            status,
            ..report.clone()
        }))
        .chain(authority_reports.into_iter().map(|state| ModerationReportContent {
            authority_report: Some(state),
            ..report.clone()
        }))
        .collect()
}

fn p2p_swap_statuses() -> Vec<P2PSwapStatus> {
    every(vec![
        P2PSwapStatus::Open,
        P2PSwapStatus::Cancelled(P2PSwapCancelled {
            token0_txn_out: Some(max()),
        }),
        P2PSwapStatus::Expired(P2PSwapCancelled {
            token0_txn_out: Some(max()),
        }),
        P2PSwapStatus::Reserved(P2PSwapReserved { reserved_by: user_id(2) }),
        P2PSwapStatus::Accepted(P2PSwapAccepted {
            accepted_by: user_id(2),
            token1_txn_in: max(),
        }),
        P2PSwapStatus::Completed(P2PSwapCompleted {
            accepted_by: user_id(2),
            token1_txn_in: max(),
            token0_txn_out: max(),
            token1_txn_out: max(),
        }),
    ])
}

fn encrypted_message_content_types() -> Vec<EncryptedMessageContentType> {
    every(vec![
        EncryptedMessageContentType::Text,
        EncryptedMessageContentType::Image,
        EncryptedMessageContentType::Video,
        EncryptedMessageContentType::Audio,
        EncryptedMessageContentType::File,
        EncryptedMessageContentType::Crypto,
        EncryptedMessageContentType::Giphy,
        EncryptedMessageContentType::Custom("custom".to_string()),
    ])
}

fn token_info(symbol: &str) -> TokenInfo {
    TokenInfo {
        symbol: symbol.to_string(),
        ledger: canister_id(5),
        decimals: max(),
        fee: max(),
    }
}

fn giphy_image_variant() -> GiphyImageVariant {
    GiphyImageVariant {
        width: max(),
        height: max(),
        url: "https://giphy.com/1".to_string(),
        mime_type: "image/gif".to_string(),
    }
}

fn thumbnail() -> ThumbnailData {
    ThumbnailData("data:image/png;base64,AAAA".to_string())
}

fn caption() -> Option<String> {
    Some("Caption".to_string())
}

fn blob_reference() -> BlobReference {
    BlobReference {
        canister_id: canister_id(8),
        blob_id: max(),
    }
}

fn account() -> icrc1::Account {
    icrc1::Account {
        owner: canister_id(1),
        subaccount: Some([1; 32]),
    }
}

fn account_identifier() -> AccountIdentifier {
    AccountIdentifier::new(&canister_id(1), &Subaccount([1; 32]))
}

fn memo() -> Memo {
    Memo::from(vec![1, 2, 3])
}

fn user_id(n: u8) -> UserId {
    canister_id(n).into()
}

fn canister_id(n: u8) -> CanisterId {
    Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, n, 1, 1])
}

// Each integer is its type's largest value, or smallest if it's signed, so that a field OpenChat
// widens fails to decode as the SDK's narrower type. The largest u64s and u128s are above 2^53,
// which OpenChat sends as strings.
fn max<T: Bounded>() -> T {
    T::max_value()
}

fn min<T: Bounded>() -> T {
    T::min_value()
}
