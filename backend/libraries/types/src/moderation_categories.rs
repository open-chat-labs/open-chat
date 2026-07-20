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
}

impl std::ops::BitOr for ModerationCategories {
    type Output = ModerationCategories;

    fn bitor(self, rhs: ModerationCategories) -> ModerationCategories {
        ModerationCategories(self.0 | rhs.0)
    }
}
