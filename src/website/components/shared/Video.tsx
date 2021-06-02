import React, { useEffect, useRef } from "react";

export interface Props {
    src: string
    className: string
}

Video.defaultProps = {
    className: ""
}

export default React.memo(Video);

function Video(props : Props): JSX.Element {
    // For some reason it is necessary to specifically set the height of the video's parent element to that of the video
    // otherwise some spurious padding appears at the bottom of the parent element
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        const ro = new ResizeObserver((entries:ResizeObserverEntry[]) => {
            for (let entry of entries) {
                const parent = entry.target.parentNode as HTMLElement;
                if (parent) {
                    parent.style.height = `${entry.contentRect.height}px`;
                }
            }
        });

        if (ro.observe && videoRef.current) {
            ro.observe(videoRef.current);
        }
    }, []);

    return <video ref={videoRef} className={props.className} controls><source src={props.src}/>Your browser does not support the video tag</video>;
}
