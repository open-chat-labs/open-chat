/** The avatar swatches' gradients, for a host drawing a face the same colour elsewhere (a picker's tile, a token's
 *  bars). Avatar re-exports it; it's here so a plain module (the app's shared logic) can read it too. */
export const AVATAR_GRADIENTS = {
  violet: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
  blue: 'linear-gradient(140deg,#3d7bff,#7a3dff)',
  teal: 'linear-gradient(140deg,#2ee6a8,#1f8fbf)',
  amber: 'linear-gradient(140deg,#ffb03d,#ff5f4d)',
  plum: 'linear-gradient(140deg,#b04dff,#4d2dff)',
};
