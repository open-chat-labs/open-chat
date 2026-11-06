import type { UserSummary } from "@client";
import { ReferrerPicker } from "./referrerPicker.svelte";

const lucy = { userId: "r1", username: "lucy", kind: "user", suspended: false } as UserSummary;
const bot = { userId: "b1", username: "helper", kind: "bot", suspended: false } as UserSummary;

function fakeClient() {
    return {
        searchUsers: vi.fn(async (_term: string, _max?: number): Promise<UserSummary[]> => []),
        getUser: vi.fn(async (_userId: string): Promise<UserSummary | undefined> => undefined),
    };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("picking a referrer", () => {
    test("searches once typing pauses, leaving out those who can't refer", async () => {
        const client = fakeClient();
        client.searchUsers.mockResolvedValue([lucy, bot]);
        const picker = new ReferrerPicker(client);
        picker.input("l");
        picker.input("lu");
        expect(picker.results).toEqual({ kind: "searching" });
        await vi.runAllTimersAsync();
        expect(client.searchUsers).toHaveBeenCalledOnce();
        expect(client.searchUsers).toHaveBeenCalledWith("lu", 20);
        expect(picker.results).toEqual({ kind: "found", users: [lucy] });
    });

    test("an empty field is no search", () => {
        const picker = new ReferrerPicker(fakeClient());
        picker.input("lu");
        picker.input(" ");
        expect(picker.results).toEqual({ kind: "idle" });
    });

    test("only the latest search counts", async () => {
        const client = fakeClient();
        let first!: (users: UserSummary[]) => void;
        client.searchUsers.mockImplementationOnce(() => new Promise((r) => (first = r)));
        client.searchUsers.mockResolvedValueOnce([]);
        const picker = new ReferrerPicker(client);
        picker.input("lu");
        await vi.runAllTimersAsync();
        picker.input("ham");
        await vi.runAllTimersAsync();
        first([lucy]);
        await vi.runAllTimersAsync();
        expect(picker.results).toEqual({ kind: "found", users: [] });
    });

    test("an invite link typed or pasted into the field goes to the confirm step", async () => {
        const client = fakeClient();
        client.getUser.mockResolvedValue(lucy);
        const picker = new ReferrerPicker(client);
        picker.input("https://oc.app/?ref=r1");
        await vi.runAllTimersAsync();
        expect(client.getUser).toHaveBeenCalledWith("r1");
        expect(client.searchUsers).not.toHaveBeenCalled();
        expect(picker.step).toEqual({ kind: "confirm", user: lucy, source: "pasted" });
    });

    test("a QR code naming no one, or no one who can refer, says so", async () => {
        const client = fakeClient();
        const picker = new ReferrerPicker(client);
        picker.scan();
        await picker.fromLink("hello", "qr");
        expect(picker.linkProblem).toBe("no_referrer");
        expect(picker.step).toEqual({ kind: "search" });

        client.getUser.mockResolvedValueOnce(bot);
        picker.scan();
        await picker.fromLink("oc.app/?ref=b1", "qr");
        expect(picker.linkProblem).toBe("unknown");
        expect(picker.step).toEqual({ kind: "search" });
    });

    test("someone picked is confirmed, or someone else picked", () => {
        const picker = new ReferrerPicker(fakeClient());
        picker.pick(lucy);
        expect(picker.step).toEqual({ kind: "confirm", user: lucy, source: "search" });
        picker.back();
        expect(picker.step).toEqual({ kind: "search" });
    });
});
