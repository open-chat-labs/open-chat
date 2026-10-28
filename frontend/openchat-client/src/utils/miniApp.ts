import type { MiniAppContent } from "@shared";

// What a MiniApp card's button does for a user, if anything. The backend issues them a token to open
// the app on the same terms: anyone while the game is taking players, and afterwards its players,
// or anyone if it's open to spectators.
export type MiniAppAction = "join" | "play" | "watch" | "view";

export function miniAppAction(content: MiniAppContent, userId: string): MiniAppAction | undefined {
    const playing = content.players.includes(userId);
    switch (content.status) {
        case "open": {
            const full =
                content.maxPlayers !== undefined && content.players.length >= content.maxPlayers;
            return playing ? "play" : full ? "view" : "join";
        }
        case "active":
            return playing ? "play" : content.spectators ? "watch" : undefined;
        case "finished":
            return playing || content.spectators ? "view" : undefined;
    }
}
