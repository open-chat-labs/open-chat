/**
 * Plays a MediaStream in a <video> (`use:stream={mediaStream}`): a stream can't be set as an
 * attribute, so it's bound as the element's srcObject, and let go when the element goes.
 */
export function stream(node: HTMLVideoElement, s: MediaStream | null) {
  node.srcObject = s;
  return {
    update(next: MediaStream | null) {
      if (node.srcObject !== next) node.srcObject = next;
    },
    destroy() {
      node.srcObject = null;
    },
  };
}
