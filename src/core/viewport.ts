// Keeps the game inside the part of the screen you can actually see, and as wide as that part. On a phone the
// browser's bars and the camera notch cover parts of the window, and iOS reports a stale size after the phone is
// turned, so a game sized to the window can lose its top and bottom rows. The game's box is set from the visual
// viewport (what is shown) less the safe-area insets (the notch), and Phaser fits the canvas into it again whenever
// that changes.
//
// The game is always GAME_H pixels tall; its width follows the box's shape (MIN_W for 16:9 or narrower, up to MAX_W
// for a phone held sideways), so a wide screen shows more of the world instead of black bars at the sides. Scenes lay
// out from `this.scale` when they are made; the planet and its UI layer also follow a later change (onScreenSize).
// Any other scene (the home screen, travel, the star map, the designs, the vault, the warren) lays out once, so a
// change of width waits until only the planet is showing; until then the canvas is fitted with bars as before.
import Phaser from 'phaser';

export const GAME_H = 270;
export const MIN_W = 480;
export const MAX_W = 720;

/** Scenes that follow a change of width while they run (onScreenSize). */
const FOLLOWS = new Set(['planet', 'ui']);

let probe: HTMLDivElement | null = null;

/** The box the game may fill, in CSS pixels: the visual viewport less the safe-area insets. */
function visibleBox() {
  if (!probe) {
    // the safe-area insets are only readable through CSS: a hidden probe padded by them
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;'
      + 'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  const vv = window.visualViewport, cs = getComputedStyle(probe);
  const t = parseFloat(cs.paddingTop) || 0, r = parseFloat(cs.paddingRight) || 0;
  const b = parseFloat(cs.paddingBottom) || 0, l = parseFloat(cs.paddingLeft) || 0;
  const w = (vv?.width ?? window.innerWidth) - l - r, h = (vv?.height ?? window.innerHeight) - t - b;
  return {
    left: (vv?.offsetLeft ?? 0) + l, top: (vv?.offsetTop ?? 0) + t,
    width: Math.max(1, Math.floor(w)), height: Math.max(1, Math.floor(h)),
  };
}

/** The game width (even) that fills a box of this shape at GAME_H tall. */
export function widthFor(boxW: number, boxH: number) {
  const w = Math.round((GAME_H * boxW) / Math.max(1, boxH) / 2) * 2;
  return Phaser.Math.Clamp(w, MIN_W, MAX_W);
}

/** The game width for the screen as it is now (for the game's config, before the game exists). */
export function startWidth() {
  const box = visibleBox();
  return widthFor(box.width, box.height);
}

export function fitToVisibleScreen(game: Phaser.Game, el: HTMLElement) {
  let want = game.scale.width;
  const fit = () => {
    const box = visibleBox();
    Object.assign(el.style, {
      left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`,
      right: 'auto', bottom: 'auto',
    });
    want = widthFor(box.width, box.height);
    game.scale.refresh();
  };
  // a new width is taken on as soon as only scenes that follow it are running
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    if (want === game.scale.width) return;
    if (game.scene.getScenes(true).some((s) => !FOLLOWS.has(s.sys.settings.key))) return;
    game.scale.setGameSize(want, GAME_H);
  });
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
  window.addEventListener('resize', fit);
  // iOS settles its bars a moment after the phone turns
  window.addEventListener('orientationchange', () => { for (const ms of [120, 450, 1000]) setTimeout(fit, ms); });
  fit();
}

/**
 * Calls `fn` now and again whenever the game's width changes, until the scene shuts down. For things laid out from
 * the screen's edges in the planet and its UI layer (the scenes in FOLLOWS).
 */
export function onScreenSize(scene: Phaser.Scene, fn: (w: number, h: number) => void) {
  fn(scene.scale.width, scene.scale.height);
  const on = (size: Phaser.Structs.Size) => fn(size.width, size.height);
  scene.scale.on(Phaser.Scale.Events.RESIZE, on);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, on));
}
