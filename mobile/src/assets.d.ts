declare module '*.png' {
  const source: import('react-native').ImageSourcePropType;
  export default source;
}

declare module '*.mp3' {
  const source: number;
  export = source;
}

declare module '*.wav' {
  const source: number;
  export = source;
}
