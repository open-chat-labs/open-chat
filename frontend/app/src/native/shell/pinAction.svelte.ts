// What a PIN asked for now would confirm, for the PIN sheet's chip ("Send **25 ICP** to Julian",
// native design notes §3.9 PIN sheet). The client asks for the PIN without saying what for
// (pinNumberResolverStore), so the screen that starts a transfer says it here while the transfer
// runs (`during`); a PIN asked for outside one shows no chip.

/** The chip: its words with the amount in them (`text` has `amount` in it), and the token's face. */
export type PinChip = {
    text: string;
    amount: string;
    token: { symbol: string; mark: string; grad: string; logo?: string };
};

class PinAction {
    #chip = $state.raw<PinChip>();

    /** The chip for the PIN being asked for, if a screen has said what it's for. */
    get chip(): PinChip | undefined {
        return this.#chip;
    }

    /** Runs `transfer` with `chip` saying what a PIN it asks for would confirm. */
    async during<T>(chip: PinChip, transfer: () => Promise<T>): Promise<T> {
        this.#chip = chip;
        try {
            return await transfer();
        } finally {
            if (this.#chip === chip) this.#chip = undefined;
        }
    }
}

export const pinAction = new PinAction();

/** The chip's words around its amount, so the amount can be bold. */
export function chipParts(chip: Pick<PinChip, "text" | "amount">): [string, string, string] {
    const at = chip.text.indexOf(chip.amount);
    if (at < 0 || chip.amount === "") return [chip.text, "", ""];
    return [chip.text.slice(0, at), chip.amount, chip.text.slice(at + chip.amount.length)];
}
