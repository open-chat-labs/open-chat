import { loadDateParser, type CommandParam } from "@shared";

type Selectable = { params: CommandParam[] } | undefined;

// Selecting a bot command reads its arguments out of what was typed after it, and a date typed in
// words can only be read once the date parser has arrived (`loadDateParser`). So a command which
// takes a date is selected once it has; any other is selected there and then, as it always was.
//
// At most one selection is ever waiting: a later one overtakes it, and `stop` drops it, which the
// command selector does when it goes, as it does when the command is cancelled.
export function dateAwareSelection<C extends Selectable>(
    select: (command: C) => void,
    loadParser: () => Promise<void> = loadDateParser,
) {
    let latest = 0;

    return {
        select(command: C): void {
            const mine = ++latest;
            if (command?.params.some((p) => p.kind === "dateTime")) {
                loadParser().then(() => {
                    if (mine === latest) select(command);
                });
            } else {
                select(command);
            }
        },
        stop(): void {
            latest++;
        },
    };
}
