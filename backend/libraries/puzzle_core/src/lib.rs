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
//! * [`Budget`] and [`SearchBudget`], which bound generating and
//!   counting solutions so a canister traps on nothing.
//! * The [`Puzzle`] trait, which every game implements and which the
//!   caller can dispatch over.
//!
//! # Contracts a game must honour
//!
//! * [`Puzzle::generate`] never loops without bound and never panics. It
//!   returns [`GenerateError::InvalidParams`] when the parameters cannot
//!   describe a puzzle of this game, and [`GenerateError::Exhausted`]
//!   when they can but no puzzle turned up within the work budget.
//! * Every entry point that takes description bytes returns a
//!   [`PuzzleError`] for malformed input rather than panicking, because
//!   these are reachable from an ingress message. That includes a
//!   description bigger than [`MAX_SIDE`]: the work a solver does grows
//!   faster than the grid, so the size bound belongs at the door and not
//!   only in `generate`.
//! * [`Puzzle::check_rules`] reports only what is *definitely* wrong: a
//!   half-filled grid is incomplete, not broken, and must come back
//!   clean. Whether the grid is finished is [`Puzzle::is_complete`], and
//!   the two together are [`Puzzle::is_solved`].

#[cfg(feature = "cli")]
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

/// One step of the solver's reasoning.
///
/// A hint carries two kinds of key and they are not always the same kind.
/// `conclusions` is always in the key space the game's `solution_pairs`
/// uses, because it fixes part of the solution. `focus` and `target` are
/// in whatever space the game draws in, which for most games is the same
/// one, but in Bridges is cell indices while conclusions are edge keys.
/// Each game's module doc says which; a client rendering hints needs that
/// per game rather than one rule for all six.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Hint<T> {
    pub technique: T,
    /// Keys to highlight: what the deduction looked at, in the game's
    /// display key space.
    pub focus: Vec<u16>,
    /// The keys the technique sentence points at ("this cell", "this
    /// number"): a subset of `focus`, painted strongly by the client
    /// while the rest of `focus` is context.
    pub target: Vec<u16>,
    /// The keys this step fixes, with the values it fixes them to, in the
    /// `solution_pairs` key space.
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
    /// The parameters are legal but this much work found nothing. A
    /// different seed may still work; parameters near a size or density
    /// limit may not. The unit is a [`Budget`] one: an attempt, or one
    /// solver run inside an attempt.
    Exhausted { work: u32 },
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
            GenerateError::Exhausted { work } => {
                write!(f, "no puzzle found in {work} units of generator work")
            }
        }
    }
}

impl std::error::Error for GenerateError {}

/// A work counter for a generate loop.
///
/// Tatham's generators retry until they succeed, which is fine in a
/// desktop program and fatal in a canister: parameters with no puzzle
/// spin until the instruction limit traps the message, and the retry
/// traps again. Every loop that can retry spends from one of these, so
/// the worst case is a `GenerateError` the caller can act on.
///
/// The unit is one solver run, and one more for each attempt. Counting
/// attempts alone would not bound anything: the clue-stripping loops run
/// a full solve per clue, so a single attempt on a [`MAX_SIDE`] grid is a
/// thousand solves, and an attempt cap leaves that unbounded. Every
/// generator therefore spends here around each `solve`, not only at the
/// top of its retry loop.
#[derive(Clone, Debug)]
pub struct Budget {
    spent: u32,
    max: u32,
}

impl Budget {
    pub fn new(max: u32) -> Self {
        Budget { spent: 0, max }
    }

    /// Charge one unit of work. `Err` once the budget is gone, which a
    /// generate loop should propagate with `?`.
    pub fn spend(&mut self) -> Result<(), GenerateError> {
        if self.spent >= self.max {
            return Err(GenerateError::Exhausted { work: self.spent });
        }
        self.spent += 1;
        Ok(())
    }

    pub fn spent(&self) -> u32 {
        self.spent
    }
}

/// How deep a solution counter may recurse before it gives up and
/// reports the cap.
///
/// Every game counts solutions by branching, one frame per key it has to
/// guess, and a description arriving from outside decides how many keys
/// there are. A wasm stack is small, and running off it traps the message
/// instead of returning a [`PuzzleError`]. Stopping short and claiming
/// the cap errs the safe way round: a count at the cap reads as "more
/// than one solution", so a puzzle is dropped rather than served with a
/// second solution nobody looked for.
pub const MAX_SEARCH_DEPTH: u32 = 256;

/// How many nodes a solution counter may explore before it gives up and
/// reports the cap.
///
/// [`MAX_SEARCH_DEPTH`] bounds one branch of the search, not the search:
/// a description with 250 open keys never reaches the depth cap and can
/// still explore 3^250 nodes, each of them cloning the working state. The
/// depth cap protects the wasm stack; this one protects the instruction
/// limit, which is what an ingress-reachable `count_solutions` runs into
/// first.
/// Measured 2026-09-11 over every size The Daily serves: the hungriest
/// real puzzle was an Unruly 12x12 at 330k nodes, with Slant close
/// behind and the other four games three orders of magnitude below. So
/// this is roughly three times the worst case a generated puzzle needs,
/// and a description built to be expensive stops here instead of running
/// until the message traps.
pub const MAX_SEARCH_NODES: u32 = 1_000_000;

/// A node counter for a solution counter, spent once per search node.
///
/// Running out is reported the same safe way round as the depth cap: the
/// count comes back at `cap`, which reads as "more than one solution", so
/// a puzzle is dropped rather than served with a second solution nobody
/// looked for.
#[derive(Clone, Debug)]
pub struct SearchBudget {
    left: u32,
}

impl SearchBudget {
    pub fn new(max: u32) -> Self {
        SearchBudget { left: max }
    }

    /// Charge one node. `false` once the budget is gone, which a counter
    /// reports as the cap.
    pub fn take(&mut self) -> bool {
        if self.left == 0 {
            return false;
        }
        self.left -= 1;
        true
    }
}

impl Default for SearchBudget {
    fn default() -> Self {
        SearchBudget::new(MAX_SEARCH_NODES)
    }
}

/// The largest side any game accepts, in cells.
///
/// The u16 key space would allow far more, but a solver, a solution
/// counter and a rule check all do work that grows with the grid, and
/// some of that work grows faster than the grid does. A description is
/// ingress-reachable, so the size it can ask for has to be one the work
/// is bounded on, not one the keys happen to fit. Every game enforces
/// this in both `validate` and `parse_description`, which keeps the two
/// in step: bytes no generator can produce are bytes no entry point
/// accepts.
pub const MAX_SIDE: usize = 32;

/// The message every game uses when a grid is bigger than [`MAX_SIDE`],
/// so `validate` and `parse_description` cannot drift apart in wording
/// either.
pub fn side_too_big(w: usize, h: usize) -> String {
    format!("width and height must be at most {MAX_SIDE}, got {w}x{h}")
}

/// Whether `w` and `h` are within [`MAX_SIDE`].
pub fn side_ok(w: usize, h: usize) -> bool {
    w <= MAX_SIDE && h <= MAX_SIDE
}

/// The four orthogonal neighbours of cell `i` in a `w` x `h` grid, in
/// Tatham's `get_surrounds` order: left, right, up, down. Three crates
/// had a character-for-character copy of this.
pub fn neighbours(w: usize, h: usize, i: usize) -> impl Iterator<Item = usize> {
    let x = i % w;
    [
        (x > 0).then(|| i - 1),
        (x + 1 < w).then(|| i + 1),
        (i >= w).then(|| i - w),
        (i + w < w * h).then(|| i + w),
    ]
    .into_iter()
    .flatten()
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

/// As [`checked_grid`], and also rejects any byte above `max`. A byte the
/// game gives no meaning to is a client bug, and reading it as an empty
/// cell hides one; every entry point that takes a player's grid rejects
/// it, rendering included.
pub fn checked_grid_values(grid: &[u8], expected: usize, max: u8) -> Result<&[u8], PuzzleError> {
    let grid = checked_grid(grid, expected)?;
    if let Some((i, &byte)) = grid.iter().enumerate().find(|&(_, &b)| b > max) {
        return Err(PuzzleError::GridValue { cell: i as u16, byte });
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
    /// A result equal to `cap` means "at least `cap`", which includes the
    /// case where the search stopped at [`MAX_SEARCH_DEPTH`] rather than
    /// finishing.
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
