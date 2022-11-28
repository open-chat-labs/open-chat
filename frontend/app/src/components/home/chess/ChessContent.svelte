<script lang="ts">
    import type { TextContent, ReplyContext } from "openchat-client";
    import ChessBoard from "./ChessBoard.svelte";

    export let repliesTo: ReplyContext | undefined = undefined;
    export let content: TextContent;

    function parseMove(txt: string): [string, string] | undefined {
        const move = txt.replace("/chess", "").trim();
        return move === "" ? undefined : (move.split(" ").map((m) => m.trim()) as [string, string]);
    }
</script>

<ChessBoard interactive={false} />
