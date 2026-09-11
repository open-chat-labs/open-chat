//! Shared machinery for The Daily's puzzle crates.
//!
//! The six games are ports of different puzzles from Simon Tatham's
//! Portable Puzzle Collection, but they present the same face to the rest
//! of the system: generate a puzzle from a seed, check a player's grid
//! against the rules, replay the solver's deductions as hints. This crate
//! holds the parts that are the same for every game, so that a fix lands
//! once and a new game cannot quietly diverge:
//!
//! * [`Rng`] and [`Dsf`], previously copied into each crate.
//! * [`Tier`], [`Hint`] and [`Generated`], the wire-facing types.
//! * [`PuzzleError`] and [`GenerateError`], the one error convention.
//! * [`Budget`], which bounds generation so a canister traps on nothing.
//! * The [`Puzzle`] trait, which every game implements and which the
//!   caller can dispatch over.
//!
//! # Contracts a game must honour
//!
//! * [`Puzzle::generate`] never loops without bound and never panics. It
//!   returns [`GenerateError::InvalidParams`] when the parameters cannot
//!   describe a puzzle of this game, and [`GenerateError::Exhausted`]
//!   when they can but no puzzle turned up within the attempt budget.
//! * Every entry point that takes description bytes returns a
//!   [`PuzzleError`] for malformed input rather than panicking, because
//!   these are reachable from an ingress message.
//! * [`Puzzle::check_rules`] reports only what is *definitely* wrong: a
//!   half-filled grid is incomplete, not broken, and must come back
//!   clean. Whether the grid is finished is [`Puzzle::is_complete`], and
//!   the two together are [`Puzzle::is_solved`].

pub mod cli;
mod dsf;
mod rng;

#[cfg(feature = "testing")]
pub mod testing;

pub use dsf::Dsf;
pub use rng::Rng;

use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[repr(u8)]
pub enum Tier {
    Easy = 0,
    Tricky = 1,
}

impl Tier {
    pub const ALL: [Tier; 2] = [Tier::Easy, Tier::Tricky];

    pub fn from_u8(byte: u8) -> Option<Tier> {
        match byte {
            0 => Some(Tier::Easy),
            1 => Some(Tier::Tricky),
            _ => None,
        }
    }
}

impl From<Tier> for u8 {
    fn from(tier: Tier) -> u8 {
        tier as u8
    }
}

/// One step of the solver's reasoning, in the key space the game's
/// `solution_pairs` uses.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Hint<T> {
    pub technique: T,
    /// Keys to highlight: what the deduction looked at.
    pub focus: Vec<u16>,
    /// The keys the technique sentence points at ("this cell", "this
    /// number"): a subset of `focus`, painted strongly by the client
    /// while the rest of `focus` is context.
    pub target: Vec<u16>,
    /// The keys this step fixes, with the values it fixes them to.
    pub conclusions: Vec<(u16, u8)>,
}

/// What the technique solver produces: its reasoning in order, and the
/// solution if it got there without guessing.
pub type Trace<T> = (Vec<Hint<T>>, Option<Vec<u8>>);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Generated<T> {
    pub description: Vec<u8>,
    pub solution: Vec<u8>,
    /// The solver's deduction trace, in order.
    pub hints: Vec<Hint<T>>,
    /// The solution in hint-key space: see `Puzzle::solution_pairs`.
    pub pairs: Vec<(u16, u8)>,
    /// The tier actually used, which is not always the one asked for:
    /// some games downgrade on grids too small to carry the harder tier.
    pub tier: Tier,
}

/// Something wrong with bytes that came from outside: a description, or a
/// player's grid. Every game returns these rather than panicking, because
/// an ingress message can carry either.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PuzzleError {
    /// The description bytes are not a puzzle of this game.
    Description(String),
    /// The grid does not have one byte per key for this description.
    GridLength { expected: usize, actual: usize },
    /// The grid holds a byte this game gives no meaning to.
    GridValue { cell: u16, byte: u8 },
}

impl PuzzleError {
    pub fn description(msg: impl Into<String>) -> Self {
        PuzzleError::Description(msg.into())
    }
}

impl fmt::Display for PuzzleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PuzzleError::Description(msg) => write!(f, "malformed description: {msg}"),
            PuzzleError::GridLength { expected, actual } => {
                write!(f, "expected a grid of {expected} bytes, got {actual}")
            }
            PuzzleError::GridValue { cell, byte } => {
                write!(f, "cell {cell} holds byte 0x{byte:02x}, which this game has no meaning for")
            }
        }
    }
}

impl std::error::Error for PuzzleError {}

/// Why no puzzle came back.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum GenerateError {
    /// No puzzle of this game can exist for these parameters, whatever
    /// the seed. The message says which parameter, and what would fix it.
    InvalidParams(String),
    /// The parameters are legal but this many attempts found nothing. A
    /// different seed may still work; parameters near a size or density
    /// limit may not.
    Exhausted { attempts: u32 },
}

impl GenerateError {
    pub fn invalid(msg: impl Into<String>) -> Self {
        GenerateError::InvalidParams(msg.into())
    }
}

impl fmt::Display for GenerateError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            GenerateError::InvalidParams(msg) => write!(f, "invalid parameters: {msg}"),
            GenerateError::Exhausted { attempts } => {
                write!(f, "no puzzle found in {attempts} attempts")
            }
        }
    }
}

impl std::error::Error for GenerateError {}

/// An attempt counter for a generate loop.
///
/// Tatham's generators retry until they succeed, which is fine in a
/// desktop program and fatal in a canister: parameters with no puzzle
/// spin until the instruction limit traps the message, and the retry
/// traps again. Every loop that can retry spends from one of these, so
/// the worst case is a `GenerateError` the caller can act on.
#[derive(Clone, Debug)]
pub struct Budget {
    spent: u32,
    max: u32,
}

impl Budget {
    pub fn new(max: u32) -> Self {
        Budget { spent: 0, max }
    }

    /// Charge one attempt. `Err` once the budget is gone, which a
    /// generate loop should propagate with `?`.
    pub fn spend(&mut self) -> Result<(), GenerateError> {
        if self.spent >= self.max {
            return Err(GenerateError::Exhausted { attempts: self.spent });
        }
        self.spent += 1;
        Ok(())
    }

    pub fn spent(&self) -> u32 {
        self.spent
    }

    pub fn remaining(&self) -> u32 {
        self.max - self.spent
    }
}

/// Check a player's grid against the length this description needs, and
/// return it. Games call this instead of silently treating a wrong-length
/// grid as empty, which used to hide a client bug as a clean board.
pub fn checked_grid(grid: &[u8], expected: usize) -> Result<&[u8], PuzzleError> {
    if grid.len() != expected {
        return Err(PuzzleError::GridLength {
            expected,
            actual: grid.len(),
        });
    }
    Ok(grid)
}

/// The face every game presents. Implemented by a unit struct per crate
/// (`LightUp`, `Tents`, ...), with the free functions in each crate
/// delegating here, so a caller can be generic over the game and the
/// compiler rejects a game whose signatures drift.
pub trait Puzzle {
    /// The knobs this game's generator takes. Games differ here: some
    /// have a density, some only a size.
    type Params: Copy + fmt::Debug;
    /// The deductions this game's solver can make. `Into<u8>` is the wire
    /// value the client renders a sentence for.
    type Technique: Copy + fmt::Debug + PartialEq + Eq + Into<u8>;
    /// The parsed form of the description bytes.
    type Description: fmt::Debug;
    /// The ways a grid can break this game's rules.
    type Violation: fmt::Debug + PartialEq + Eq;

    const GAME_ID: &'static str;

    /// Deterministic: the same seed and parameters always give the same
    /// bytes. Never loops without bound, and never panics.
    fn generate(seed: u64, params: Self::Params) -> Result<Generated<Self::Technique>, GenerateError>;

    fn parse_description(bytes: &[u8]) -> Result<Self::Description, PuzzleError>;

    /// Everything about `grid` that is definitely wrong. An unfinished
    /// grid is not wrong, so this is empty for a blank board and stays
    /// empty while the player fills it in correctly.
    fn check_rules(description: &[u8], grid: &[u8]) -> Result<Vec<Self::Violation>, PuzzleError>;

    /// Whether `grid` is finished: every key decided and every counting
    /// rule met exactly. Says nothing about whether it is *correct*, for
    /// which see [`Puzzle::is_solved`].
    fn is_complete(description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError>;

    /// The solution in hint-key space, sorted by key: the same keys and
    /// values that hint conclusions use.
    fn solution_pairs(description: &[u8], solution: &[u8]) -> Result<Vec<(u16, u8)>, PuzzleError>;

    /// Number of solutions, counted by backtracking and capped at `cap`.
    fn count_solutions(description: &[u8], cap: u32) -> Result<u32, PuzzleError>;

    /// Run the technique solver and return its trace, plus the solution
    /// if it got there without guessing.
    fn solve_with_trace(description: &[u8], tier: Tier) -> Result<Trace<Self::Technique>, PuzzleError>;

    fn render_ascii(description: &[u8], grid: Option<&[u8]>) -> Result<String, PuzzleError>;

    /// The question the canister asks of a submitted grid.
    fn is_solved(description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
        Ok(Self::check_rules(description, grid)?.is_empty() && Self::is_complete(description, grid)?)
    }
}

/// The part of [`Puzzle`] that mentions no game-specific type, so it can
/// be used through a `dyn` reference.
///
/// [`Puzzle`] itself cannot: `Params`, `Violation` and the rest differ
/// from game to game, which is the point of them. But a caller holding a
/// description and a player's grid does not need those types, and this is
/// what lets such a caller keep a table of games rather than a match arm
/// per game:
///
/// ```ignore
/// const GAMES: &[&dyn PuzzleCheck] = &[&LightUp, &Tents, &Bridges, &Loopy, &Slant, &Unruly];
///
/// let game = GAMES.iter().find(|g| g.game_id() == id).ok_or(...)?;
/// let solved = game.is_solved(&description, &grid)?;
/// ```
///
/// Generating still goes through [`Puzzle::generate`], because only the
/// caller that chose a game knows what its parameters mean.
pub trait PuzzleCheck {
    fn game_id(&self) -> &'static str;

    /// Whether these bytes describe a puzzle of this game.
    fn accepts_description(&self, description: &[u8]) -> Result<(), PuzzleError>;

    /// Whether the grid breaks a rule. The violations themselves are
    /// game-specific, so this says only that there is at least one; use
    /// the game's own `check_rules` to show the player which.
    fn has_violations(&self, description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError>;

    fn is_complete(&self, description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError>;

    fn is_solved(&self, description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError>;

    fn count_solutions(&self, description: &[u8], cap: u32) -> Result<u32, PuzzleError>;

    fn render_ascii(&self, description: &[u8], grid: Option<&[u8]>) -> Result<String, PuzzleError>;
}

impl<P: Puzzle> PuzzleCheck for P {
    fn game_id(&self) -> &'static str {
        P::GAME_ID
    }

    fn accepts_description(&self, description: &[u8]) -> Result<(), PuzzleError> {
        P::parse_description(description).map(|_| ())
    }

    fn has_violations(&self, description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
        Ok(!P::check_rules(description, grid)?.is_empty())
    }

    fn is_complete(&self, description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
        P::is_complete(description, grid)
    }

    fn is_solved(&self, description: &[u8], grid: &[u8]) -> Result<bool, PuzzleError> {
        P::is_solved(description, grid)
    }

    fn count_solutions(&self, description: &[u8], cap: u32) -> Result<u32, PuzzleError> {
        P::count_solutions(description, cap)
    }

    fn render_ascii(&self, description: &[u8], grid: Option<&[u8]>) -> Result<String, PuzzleError> {
        P::render_ascii(description, grid)
    }
}
