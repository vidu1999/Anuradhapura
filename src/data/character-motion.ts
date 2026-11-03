/** Animation is based only on browser-reported speed in metres per second, not transport mode. */
export type CharacterMotion = 'wait' | 'walk' | 'run';
export function characterMotion(speed: number | null | undefined): CharacterMotion {
  if (speed == null || !Number.isFinite(speed) || speed < 0.5) return 'wait';
  return speed < 3 ? 'walk' : 'run';
}
/** Model clips must identify their purpose; never silently substitute an unrelated clip. */
export function findMotionClips<T extends {name:string}>(clips: T[]): Record<CharacterMotion, T | undefined> {
  const find = (pattern: RegExp) => clips.find(clip => pattern.test(clip.name));
  return { wait: find(/wait|idle|standing/i), walk: find(/walk/i), run: find(/run|sprint|jog/i) };
}
