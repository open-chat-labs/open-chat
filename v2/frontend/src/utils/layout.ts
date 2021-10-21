import type { ImageContent, VideoContent } from "../domain/chat/chat";

// todo - yes this is a bit of a magic number but, hey it works ...
const MSG_ACTION_WIDTH = 51.19;

// we need to calculate the height that a visual content element *should* have so that the scroll
// position is known *before* the elements are rendered. This is necessary to make scrollToBottom work
// reliably.
export function calculateHeight(parentWidth: number, content: ImageContent | VideoContent): number {
    const halfHeight = window.innerHeight / 2;
    const landscape = content.height < content.width;
    const ratio = content.height / content.width;
    const availWidth = parentWidth - MSG_ACTION_WIDTH;
    const calculatedWidth = Math.min(availWidth, halfHeight);
    const calculatedHeight = landscape
        ? Math.min(calculatedWidth * ratio, halfHeight)
        : Math.min(content.height, halfHeight);
    return calculatedHeight;
}
