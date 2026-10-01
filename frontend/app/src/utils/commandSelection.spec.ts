import { defaultDateTimeParam, defaultStringParam, type CommandParam } from "@shared";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { dateAwareSelection } from "./commandSelection";

type Command = { name: string; params: CommandParam[] };

const remind: Command = { name: "remind", params: [defaultDateTimeParam()] };
const schedule: Command = {
    name: "schedule",
    params: [defaultStringParam(), defaultDateTimeParam()],
};
const echo: Command = { name: "echo", params: [defaultStringParam()] };

describe("selecting a bot command", () => {
    let select: ReturnType<typeof vi.fn<(command: Command | undefined) => void>>;
    let parserLoaded: () => void;
    let loadParser: ReturnType<typeof vi.fn<() => Promise<void>>>;
    let selection: ReturnType<typeof dateAwareSelection<Command | undefined>>;

    // lets the promise callbacks queued so far run
    const settle = () => new Promise((resolve) => setTimeout(resolve));

    beforeEach(() => {
        select = vi.fn();
        loadParser = vi.fn(() => new Promise<void>((resolve) => (parserLoaded = resolve)));
        selection = dateAwareSelection(select, loadParser);
    });

    test("a command which takes no date is selected there and then", () => {
        selection.select(echo);
        expect(select).toHaveBeenCalledExactlyOnceWith(echo);
        expect(loadParser).not.toHaveBeenCalled();
    });

    test("no command at all is passed straight through", () => {
        selection.select(undefined);
        expect(select).toHaveBeenCalledExactlyOnceWith(undefined);
    });

    // Invariant: a command which takes a date is never selected before the date parser has
    // arrived, so a date typed in words is never read without it.
    test("a command which takes a date waits for the date parser", async () => {
        selection.select(schedule);
        await settle();
        expect(select).not.toHaveBeenCalled();

        parserLoaded();
        await settle();
        expect(select).toHaveBeenCalledExactlyOnceWith(schedule);
    });

    test("selecting it again while it waits selects it once", async () => {
        selection.select(remind);
        selection.select(remind);
        parserLoaded();
        await settle();
        expect(select).toHaveBeenCalledTimes(1);
    });

    test("a later selection overtakes one which is waiting", async () => {
        selection.select(remind);
        selection.select(echo);
        expect(select).toHaveBeenCalledExactlyOnceWith(echo);

        parserLoaded();
        await settle();
        expect(select).toHaveBeenCalledTimes(1);
    });

    test("a selection still waiting when the selector goes is dropped", async () => {
        selection.select(remind);
        selection.stop();
        parserLoaded();
        await settle();
        expect(select).not.toHaveBeenCalled();
    });
});
