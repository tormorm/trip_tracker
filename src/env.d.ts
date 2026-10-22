declare module 'exifr/dist/lite.esm.mjs' {
  export function gps(input: Blob | ArrayBuffer | string): Promise<{ latitude: number; longitude: number } | undefined>;
}
