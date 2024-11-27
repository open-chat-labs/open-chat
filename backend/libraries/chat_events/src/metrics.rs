use serde::{Deserialize, Serialize};
use std::cmp::{max, min};
use types::{ChatMetrics, TimestampMillis};

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
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
}
