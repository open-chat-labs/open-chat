import React, { useLayoutEffect, useState } from "react";
import Zoom from "@material-ui/core/Zoom";
import Fab from "@material-ui/core/Fab";
import ArrowDownwardIcon from "@material-ui/icons/ArrowDownward";

export default React.memo(ScrollToBottomButton);

type Props = {
    className?: string,
    parentElem: React.RefObject<HTMLElement>
}

function ScrollToBottomButton(props: Props) {
    const [buttonVisible, setButtonVisible] = useState(false);

    useLayoutEffect(() => {
        const parentElem = props.parentElem.current;
        if (!parentElem) {
            return;
        }

        const onScroll = (e: Event) => onScroll_toggleButtonVisibility(e.target as HTMLElement);
        parentElem.addEventListener("scroll", onScroll);

        onScroll_toggleButtonVisibility(parentElem);

        return () => parentElem.removeEventListener("scroll", onScroll);
    }, [props.parentElem.current, buttonVisible]);

    function onScroll_toggleButtonVisibility(messagesDiv: HTMLElement) {
        const scrollBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight;
        const shouldShowButton = scrollBottom > 50;
        if (shouldShowButton !== buttonVisible) {
            setButtonVisible(shouldShowButton);
        }
    }

    function scrollToBottom() {
        const parentElem = props.parentElem.current;
        if (parentElem) {
            parentElem.scrollTo({ top: parentElem.scrollHeight - parentElem.clientHeight });
        }
    }

    return (
        <Zoom in={buttonVisible}>
            <Fab onClick={scrollToBottom} className={props.className} size="medium">
                <ArrowDownwardIcon />
            </Fab>
        </Zoom>
    );
}
