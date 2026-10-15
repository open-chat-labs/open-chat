<!-- 3D spinning token coin: stacked edge layers + two faces with the token mark, soft floor shadow. Paused with reduced motion. -->
<script lang="ts">
  import { useT } from '../i18n';
  interface Props {
    symbol: string;
    /** Face glyph; defaults to the symbol's first letter. */
    mark?: string;
    gradient?: string;
    /** Edge stripe colours, alternating per layer. */
    edge?: string;
    edge2?: string;
    size?: number;
  }

  let { symbol, mark, gradient = 'linear-gradient(140deg,#ff5f9e,#6a2bff)', edge = '#7a2bd0', edge2 = '#5a1fa0', size = 80 }: Props = $props();
  const t = useT();

  const thickness = $derived(Math.round(size * 0.14));
  const layers = $derived.by(() => {
    const out: { z: number; bg: string }[] = [];
    for (let z = -thickness / 2; z <= thickness / 2; z += 1) out.push({ z, bg: Math.round(z) % 2 === 0 ? edge : edge2 });
    return out;
  });
  const faceZ = $derived(thickness / 2 + 0.5);
</script>

<span class="coin-wrap" role="img" aria-label={t('ui.tokenCoin.label', { symbol })}
  ><span class="stage" aria-hidden="true" style:perspective="{size * 6}px">
    <span class="coin" data-oc-motion="" style:width="{size}px" style:height="{size}px">
      {#each layers as layer}<span class="layer" style:transform="translateZ({layer.z}px)" style:background={layer.bg}></span>{/each}
      {#each [`translateZ(${faceZ}px)`, `rotateY(180deg) translateZ(${faceZ}px)`] as transform}<span
          class="face"
          style:transform
          style:background="radial-gradient(circle at 35% 30%,rgba(255,255,255,.45),transparent 45%),{gradient}"
          style:box-shadow="inset 0 0 0 {Math.max(2, size * 0.05)}px rgba(255,255,255,.28)"
          style:font-size="{Math.round(size * 0.42)}px">{mark ?? symbol[0]}</span
        >{/each}
    </span>
    <span class="floor" style:width="{size * 0.7}px" style:height="{size * 0.1}px" style:margin="{size * 0.12}px auto 0"></span>
  </span></span
>

<style>
  .coin-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .stage {
    display: block;
  }

  .coin {
    position: relative;
    display: block;
    transform-style: preserve-3d;
    animation: ocCoinSpin 4s linear infinite;
  }

  .layer,
  .face {
    position: absolute;
    inset: 0;
    border-radius: 50%;
  }

  .face {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    line-height: 1;
    font-family: var(--font-sans);
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    backface-visibility: hidden;
  }

  .floor {
    display: block;
    border-radius: 50%;
    background: radial-gradient(closest-side, rgba(0, 0, 0, 0.45), transparent);
  }
</style>
