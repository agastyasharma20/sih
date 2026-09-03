// Next 14 does not ship an ambient declaration for side-effect CSS imports,
// which TypeScript 5.x rejects under moduleResolution "bundler" (TS2882).
declare module '*.css';
