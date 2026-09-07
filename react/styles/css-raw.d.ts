/** Vite resolves `?raw` imports to the file's contents as a string. */
declare module '*.css?raw' {
  const css: string;
  export default css;
}
