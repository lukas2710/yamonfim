export interface StreamQuality { height: number; bandwidth: number }
export function hlsQuality(manifest: string): StreamQuality {
  const variants = manifest.split(/\r?\n/).filter(line => line.startsWith('#EXT-X-STREAM-INF:')).map(line => ({
    height: Number(line.match(/RESOLUTION=\d+x(\d+)/i)?.[1] || 0),
    bandwidth: Number(line.match(/(?:[:,])BANDWIDTH=(\d+)/i)?.[1] || 0),
  }));
  return variants.sort((a, b) => compareQuality(b, a))[0] || { height: 0, bandwidth: 0 };
}
export function compareQuality(a?: StreamQuality, b?: StreamQuality) {
  return (a?.height || 0) - (b?.height || 0) || (a?.bandwidth || 0) - (b?.bandwidth || 0);
}
