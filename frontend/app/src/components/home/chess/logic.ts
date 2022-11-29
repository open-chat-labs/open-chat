// TODO - replace all this with the chess library. There's actually a lot to it and it's not straightforward
// really want to be focusing on the custom message api, not on implementing chess
export type Colour = "white" | "black";

export type PieceType = "pawn" | "rook" | "bishop" | "knight" | "king" | "queen";

export type Pieces = Record<string, Piece>;

export class Game {
    state: Pieces;
    next: Colour;

    constructor(serialised?: string) {
        const game = serialised
            ? JSON.parse(serialised)
            : {
                  state: initialState,
                  next: "white",
              };
        this.state = game.state;
        this.next = game.next;
    }

    getPiece(col: number, row: number): Piece | undefined {
        return this.state[fromCoords(col, row)];
    }

    /**
     * Needs to account for
     * 1) things being in the way
     * 2) special moves (for pawns & rooks)
     * 3) leaving ourselves in check
     */
    validMove(from: [number, number], to: [number, number]): boolean {
        const fromKey = fromCoords(from[0], from[1]);
        const toKey = fromCoords(to[0], to[1]);
        const current = this.state[fromKey];
        const target = this.state[toKey];
        if (current === undefined) return false;
        if (target !== undefined && target.colour === this.next) return false;
        if (from[0] === to[0] && from[1] === to[1]) return false;
        return this.legalMove(from, to);
    }

    legalMove(from: [number, number], to: [number, number]): boolean {
        const fromKey = fromCoords(from[0], from[1]);
        const current = this.state[fromKey];

        switch (current.type) {
            case "bishop":
                return validBishop(from, to);
            case "king":
                return validKing(from, to);
            case "rook":
                return validRook(from, to);
            case "queen":
                return validQueen(from, to);
            case "knight":
                return validKnight(from, to);
            case "pawn":
                return validPawn(from, to);
        }
    }

    move(from: [number, number], to: [number, number]): void {
        if (!this.validMove(from, to)) return;

        const fromKey = fromCoords(from[0], from[1]);
        const toKey = fromCoords(to[0], to[1]);

        const current = this.state[fromKey];
        if (current) {
            this.state[toKey] = current;
            delete this.state[fromKey];
            this.next = this.next === "white" ? "black" : "white";
        }
    }
}

export type Piece = {
    colour: Colour;
    type: PieceType;
};

const letters = "abcdefgh";

const initialState: Pieces = {
    a8: { colour: "white", type: "rook" },
    b8: { colour: "white", type: "knight" },
    c8: { colour: "white", type: "bishop" },
    d8: { colour: "white", type: "queen" },
    e8: { colour: "white", type: "king" },
    f8: { colour: "white", type: "bishop" },
    g8: { colour: "white", type: "knight" },
    h8: { colour: "white", type: "rook" },
    a7: { colour: "white", type: "pawn" },
    b7: { colour: "white", type: "pawn" },
    c7: { colour: "white", type: "pawn" },
    d7: { colour: "white", type: "pawn" },
    e7: { colour: "white", type: "pawn" },
    f7: { colour: "white", type: "pawn" },
    g7: { colour: "white", type: "pawn" },
    h7: { colour: "white", type: "pawn" },
    a2: { colour: "black", type: "pawn" },
    b2: { colour: "black", type: "pawn" },
    c2: { colour: "black", type: "pawn" },
    d2: { colour: "black", type: "pawn" },
    e2: { colour: "black", type: "pawn" },
    f2: { colour: "black", type: "pawn" },
    g2: { colour: "black", type: "pawn" },
    h2: { colour: "black", type: "pawn" },
    a1: { colour: "black", type: "rook" },
    b1: { colour: "black", type: "knight" },
    c1: { colour: "black", type: "bishop" },
    d1: { colour: "black", type: "queen" },
    e1: { colour: "black", type: "king" },
    f1: { colour: "black", type: "bishop" },
    g1: { colour: "black", type: "knight" },
    h1: { colour: "black", type: "rook" },
};

export const initialGameState: Game = new Game();

export function fromCoords(c: number, r: number): string {
    return `${letters[c]}${Math.abs(r - 8)}`;
}

function toCoord(pos: string): [number, number] {
    const x = letters.indexOf(pos[0].toLowerCase());
    const y = Number(pos[1]);
    return [x, y];
}
function validQueen(from: [number, number], to: [number, number]): boolean {
    return validRook(from, to) || validBishop(from, to);
}

function validBishop([x1, y1]: [number, number], [x2, y2]: [number, number]): boolean {
    return Math.abs(x2 - x1) === Math.abs(y2 - y1);
}

function validRook([x1, y1]: [number, number], [x2, y2]: [number, number]): boolean {
    return x2 === x1 || y2 === y1;
}

function validKing([x1, y1]: [number, number], [x2, y2]: [number, number]): boolean {
    return Math.abs(x2 - x1) <= 1 && Math.abs(y2 - y1) <= 1;
}

function validPawn([x1, y1]: [number, number], [x2, y2]: [number, number]): boolean {
    // TODO - need to account for opening move (where 2 spaces is allowed) and possible diagonal moves
    return x2 === x1 && Math.abs(y2 - y1) === 1; // not quite good enough
}

function validKnight([x1, y1]: [number, number], [x2, y2]: [number, number]): boolean {
    return (
        (Math.abs(x2 - x1) === 1 && Math.abs(y2 - y1) === 2) ||
        (Math.abs(x2 - x1) === 2 && Math.abs(y2 - y1) === 1)
    );
}
