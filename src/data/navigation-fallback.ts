/** Keep unsupported WebGL or browser initialization failures out of React's render lifecycle. */
export function initializeNavigationMap<T>(create: () => T): {map:T; error:null} | {map:null; error:unknown} {
  try { return { map:create(), error:null }; }
  catch (error) { return { map:null, error }; }
}
export function navigationFailureMessage(error: unknown): string {
  const text=error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /webgl|gpu/i.test(text)
    ? '3D navigation requires WebGL2, which is unavailable in this browser. Switched to the 2D map; GPS and road routing remain available.'
    : '3D navigation could not start. Switched to the 2D map; GPS and road routing remain available.';
}
