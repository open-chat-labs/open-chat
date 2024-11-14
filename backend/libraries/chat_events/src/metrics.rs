use serde::{Deserialize, Serialize};
use std::cmp::{max, min};
use tracing::error;
use types::{is_default, ChatMetrics, TimestampMillis};

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
#[serde(from = "ChatMetricsInternalCombined")]
pub struct ChatMetricsInternal {
    #[serde(rename = "m")]
    metrics: Vec<MetricCounter>,
    #[serde(rename = "l")]
    pub last_active: TimestampMillis,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, Copy)]
struct MetricCounter([u8; 4]);

impl MetricCounter {
    const MAX_COUNT: u32 = 0x00FFFFFF; // 16777215

    fn new(key: MetricKey, count: u32) -> MetricCounter {
        let mut bytes = [0; 4];
        bytes[0] = key as u8;

        let count_bytes = min(count, Self::MAX_COUNT).to_be_bytes();
        bytes[1..].copy_from_slice(&count_bytes[1..]);
        MetricCounter(bytes)
    }

    pub fn key(&self) -> MetricKey {
        self.0[0].into()
    }

    pub fn count(&self) -> u32 {
        let mut count_bytes = [0; 4];
        count_bytes[1..].copy_from_slice(&self.0[1..]);
        u32::from_be_bytes(count_bytes)
    }

    pub fn incr(&mut self, amount: u32) {
        let count = min(self.count().saturating_add(amount), Self::MAX_COUNT);
        let count_bytes = count.to_be_bytes();
        self.0[1..].copy_from_slice(&count_bytes[1..]);
    }

    pub fn decr(&mut self, amount: u32) {
        let count = self.count().saturating_sub(amount);
        let count_bytes = count.to_be_bytes();
        self.0[1..].copy_from_slice(&count_bytes[1..]);
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum MetricKey {
    Unknown = 0,
    TextMessages = 1,
    ImageMessages = 2,
    VideoMessages = 3,
    AudioMessages = 4,
    FileMessages = 5,
    Polls = 6,
    PollVotes = 7,
    CryptoMessages = 8,
    DeletedMessages = 9,
    GiphyMessages = 10,
    PrizeMessages = 11,
    PrizeWinnerMessages = 12,
    Replies = 13,
    Edits = 14,
    Reactions = 15,
    Tips = 16,
    Proposals = 17,
    ReportedMessages = 18,
    MessageReminders = 19,
    P2pSwaps = 20,
    VideoCalls = 21,
    CustomTypeMessages = 22,
}

impl From<u8> for MetricKey {
    fn from(value: u8) -> Self {
        match value {
            1 => Self::TextMessages,
            2 => Self::ImageMessages,
            3 => Self::VideoMessages,
            4 => Self::AudioMessages,
            5 => Self::FileMessages,
            6 => Self::Polls,
            7 => Self::PollVotes,
            8 => Self::CryptoMessages,
            9 => Self::DeletedMessages,
            10 => Self::GiphyMessages,
            11 => Self::PrizeMessages,
            12 => Self::PrizeWinnerMessages,
            13 => Self::Replies,
            14 => Self::Edits,
            15 => Self::Reactions,
            16 => Self::Tips,
            17 => Self::Proposals,
            18 => Self::ReportedMessages,
            19 => Self::MessageReminders,
            20 => Self::P2pSwaps,
            21 => Self::VideoCalls,
            22 => Self::CustomTypeMessages,
            _ => Self::Unknown,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
struct ChatMetricsInternalCombined {
    #[serde(rename = "m", default)]
    metrics: Vec<MetricCounter>,
    #[serde(rename = "t", default, skip_serializing_if = "is_default")]
    pub text_messages: u64,
    #[serde(rename = "i", default, skip_serializing_if = "is_default")]
    pub image_messages: u64,
    #[serde(rename = "v", default, skip_serializing_if = "is_default")]
    pub video_messages: u64,
    #[serde(rename = "a", default, skip_serializing_if = "is_default")]
    pub audio_messages: u64,
    #[serde(rename = "f", default, skip_serializing_if = "is_default")]
    pub file_messages: u64,
    #[serde(rename = "p", default, skip_serializing_if = "is_default")]
    pub polls: u64,
    #[serde(rename = "pv", default, skip_serializing_if = "is_default")]
    pub poll_votes: u64,
    #[serde(rename = "icp", default, skip_serializing_if = "is_default")]
    pub icp_messages: u64,
    #[serde(rename = "sns1", default, skip_serializing_if = "is_default")]
    pub sns1_messages: u64,
    #[serde(rename = "ckbtc", default, skip_serializing_if = "is_default")]
    pub ckbtc_messages: u64,
    #[serde(rename = "chat", default, skip_serializing_if = "is_default")]
    pub chat_messages: u64,
    #[serde(rename = "kinic", default, skip_serializing_if = "is_default")]
    pub kinic_messages: u64,
    #[serde(rename = "o", default, skip_serializing_if = "is_default")]
    pub other_crypto_messages: u64,
    #[serde(rename = "d", default, skip_serializing_if = "is_default")]
    pub deleted_messages: u64,
    #[serde(rename = "g", default, skip_serializing_if = "is_default")]
    pub giphy_messages: u64,
    #[serde(rename = "pz", default, skip_serializing_if = "is_default")]
    pub prize_messages: u64,
    #[serde(rename = "pzw", default, skip_serializing_if = "is_default")]
    pub prize_winner_messages: u64,
    #[serde(rename = "rp", default, skip_serializing_if = "is_default")]
    pub replies: u64,
    #[serde(rename = "e", default, skip_serializing_if = "is_default")]
    pub edits: u64,
    #[serde(rename = "rt", default, skip_serializing_if = "is_default")]
    pub reactions: u64,
    #[serde(rename = "ti", default, skip_serializing_if = "is_default")]
    pub tips: u64,
    #[serde(rename = "pr", default, skip_serializing_if = "is_default")]
    pub proposals: u64,
    #[serde(rename = "rpt", default, skip_serializing_if = "is_default")]
    pub reported_messages: u64,
    #[serde(rename = "mr", default, skip_serializing_if = "is_default")]
    pub message_reminders: u64,
    #[serde(rename = "p2p", default, skip_serializing_if = "is_default")]
    pub p2p_swaps: u64,
    #[serde(rename = "vc", default, skip_serializing_if = "is_default")]
    pub video_calls: u64,
    #[serde(rename = "cu", default, skip_serializing_if = "is_default")]
    pub custom_type_messages: u64,
    #[serde(rename = "la", alias = "l")]
    pub last_active: TimestampMillis,
}

impl From<ChatMetricsInternalCombined> for ChatMetricsInternal {
    fn from(value: ChatMetricsInternalCombined) -> Self {
        if !value.metrics.is_empty() {
            return ChatMetricsInternal {
                metrics: value.metrics,
                last_active: value.last_active,
            };
        }

        let mut metrics = ChatMetricsInternal {
            metrics: Vec::new(),
            last_active: value.last_active,
        };

        if let Ok(count) = try_convert_to_metric_count(value.text_messages, "text_messages") {
            metrics.metrics.push(MetricCounter::new(MetricKey::TextMessages, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.image_messages, "image_messages") {
            metrics.metrics.push(MetricCounter::new(MetricKey::ImageMessages, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.video_messages, "video_messages") {
            metrics.metrics.push(MetricCounter::new(MetricKey::VideoMessages, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.audio_messages, "audio_messages") {
            metrics.metrics.push(MetricCounter::new(MetricKey::AudioMessages, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.file_messages, "file_messages") {
            metrics.metrics.push(MetricCounter::new(MetricKey::FileMessages, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.polls, "polls") {
            metrics.metrics.push(MetricCounter::new(MetricKey::Polls, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.poll_votes, "poll_votes") {
            metrics.metrics.push(MetricCounter::new(MetricKey::PollVotes, count));
        }
        let crypto_messages = value.icp_messages
            + value.sns1_messages
            + value.ckbtc_messages
            + value.chat_messages
            + value.kinic_messages
            + value.other_crypto_messages;
        if let Ok(count) = try_convert_to_metric_count(crypto_messages, "crypto_messages") {
            metrics.metrics.push(MetricCounter::new(MetricKey::CryptoMessages, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.deleted_messages, "deleted_messages") {
            metrics.metrics.push(MetricCounter::new(MetricKey::DeletedMessages, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.giphy_messages, "giphy_messages") {
            metrics.metrics.push(MetricCounter::new(MetricKey::GiphyMessages, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.prize_messages, "prize_messages") {
            metrics.metrics.push(MetricCounter::new(MetricKey::PrizeMessages, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.prize_winner_messages, "prize_winner_messages") {
            metrics
                .metrics
                .push(MetricCounter::new(MetricKey::PrizeWinnerMessages, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.replies, "replies") {
            metrics.metrics.push(MetricCounter::new(MetricKey::Replies, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.edits, "edits") {
            metrics.metrics.push(MetricCounter::new(MetricKey::Edits, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.reactions, "reactions") {
            metrics.metrics.push(MetricCounter::new(MetricKey::Reactions, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.tips, "tips") {
            metrics.metrics.push(MetricCounter::new(MetricKey::Tips, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.proposals, "proposals") {
            metrics.metrics.push(MetricCounter::new(MetricKey::Proposals, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.reported_messages, "reported_messages") {
            metrics.metrics.push(MetricCounter::new(MetricKey::ReportedMessages, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.message_reminders, "message_reminders") {
            metrics.metrics.push(MetricCounter::new(MetricKey::MessageReminders, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.p2p_swaps, "p2p_swaps") {
            metrics.metrics.push(MetricCounter::new(MetricKey::P2pSwaps, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.video_calls, "video_calls") {
            metrics.metrics.push(MetricCounter::new(MetricKey::VideoCalls, count));
        }
        if let Ok(count) = try_convert_to_metric_count(value.custom_type_messages, "custom_type_messages") {
            metrics.metrics.push(MetricCounter::new(MetricKey::CustomTypeMessages, count));
        }
        metrics
    }
}

fn try_convert_to_metric_count(value: u64, name: &str) -> Option<u32> {
    if let Ok(count) = u32::try_from(value) {
        if count > 0 {
            Some(count)
        } else {
            None
        }
    } else {
        error!(name, value, "Metric value exceeded limit");
        None
    }
}

impl ChatMetricsInternal {
    pub fn incr(&mut self, key: MetricKey, count: u32) {
        if let Some(m) = self.metrics.iter_mut().find(|m| m.key() == key) {
            m.incr(count);
        } else {
            self.metrics.push(MetricCounter::new(key, count));
        }
    }

    pub fn decr(&mut self, key: MetricKey, count: u32) {
        if let Some((i, m)) = self.metrics.iter_mut().enumerate().find(|(_, m)| m.key() == key) {
            if m.count() <= count {
                self.metrics.remove(i);
            } else {
                m.decr(count);
            }
        }
    }

    pub fn merge(&mut self, other: &ChatMetricsInternal) {
        for metric in other.metrics.iter() {
            self.incr(metric.key(), metric.count());
        }
        self.last_active = max(self.last_active, other.last_active);
    }

    pub fn hydrate(&self) -> ChatMetrics {
        ChatMetrics {
            text_messages: self.get(MetricKey::TextMessages) as u64,
            image_messages: self.get(MetricKey::ImageMessages) as u64,
            video_messages: self.get(MetricKey::VideoMessages) as u64,
            audio_messages: self.get(MetricKey::AudioMessages) as u64,
            file_messages: self.get(MetricKey::FileMessages) as u64,
            polls: self.get(MetricKey::Polls) as u64,
            poll_votes: self.get(MetricKey::PollVotes) as u64,
            crypto_messages: self.get(MetricKey::CryptoMessages) as u64,
            icp_messages: self.get(MetricKey::CryptoMessages) as u64,
            sns1_messages: 0,
            ckbtc_messages: 0,
            chat_messages: 0,
            kinic_messages: 0,
            deleted_messages: self.get(MetricKey::DeletedMessages) as u64,
            giphy_messages: self.get(MetricKey::GiphyMessages) as u64,
            prize_messages: self.get(MetricKey::PrizeMessages) as u64,
            prize_winner_messages: self.get(MetricKey::PrizeWinnerMessages) as u64,
            replies: self.get(MetricKey::Replies) as u64,
            edits: self.get(MetricKey::Edits) as u64,
            reactions: self.get(MetricKey::Reactions) as u64,
            proposals: self.get(MetricKey::Proposals) as u64,
            reported_messages: self.get(MetricKey::ReportedMessages) as u64,
            message_reminders: self.get(MetricKey::MessageReminders) as u64,
            custom_type_messages: self.get(MetricKey::CustomTypeMessages) as u64,
            last_active: self.last_active,
        }
    }

    fn get(&self, key: MetricKey) -> u32 {
        self.metrics.iter().find(|m| m.key() == key).map_or(0, |m| m.count())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metrics_key_roundtrip() {
        let mut keys = Vec::new();
        let mut value = 0u8;
        loop {
            let key = MetricKey::from(value);

            if value <= 22 {
                assert!(key as u8 == value);
                assert!(!keys.contains(&key));
                keys.push(key);
                value += 1;
            } else {
                assert!(key == MetricKey::Unknown);
                break;
            }
        }
    }

    #[test]
    fn incr_decr() {
        for i in 1u8..5 {
            let key = MetricKey::from(i);
            let mut metric = MetricCounter::new(key, 1);
            metric.incr(1);

            assert_eq!(metric.key(), key);
            assert_eq!(metric.count(), 2);

            metric.incr(1000);
            assert_eq!(metric.key(), key);
            assert_eq!(metric.count(), 1002);

            metric.decr(1);
            assert_eq!(metric.key(), key);
            assert_eq!(metric.count(), 1001);

            metric.decr(1000);
            assert_eq!(metric.key(), key);
            assert_eq!(metric.count(), 1);

            metric.decr(10);
            assert_eq!(metric.key(), key);
            assert_eq!(metric.count(), 0);

            metric.incr(MetricCounter::MAX_COUNT);
            assert_eq!(metric.key(), key);
            assert_eq!(metric.count(), MetricCounter::MAX_COUNT);

            metric.incr(1);
            assert_eq!(metric.key(), key);
            assert_eq!(metric.count(), MetricCounter::MAX_COUNT);
        }
    }

    #[test]
    fn size() {
        assert_eq!(size_of::<MetricCounter>(), 4);
    }

    #[test]
    fn serialize_roundtrip() {
        let input = ChatMetricsInternalCombined {
            last_active: 1,
            text_messages: 1,
            ..Default::default()
        };

        let bytes = msgpack::serialize_then_unwrap(input);
        let output: ChatMetricsInternal = msgpack::deserialize_then_unwrap(&bytes);

        assert_eq!(output.last_active, 1);
    }
}
