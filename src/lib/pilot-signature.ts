// Store bounded numeric strokes, never uploaded SVG/HTML or executable markup.
export type SchoolSignature = { version: 1; strokes: [number, number][][] };
export function validateSignature(input: unknown): SchoolSignature {
  if (!input || typeof input !== "object") throw new Error("Draw your signature");
  const value = input as SchoolSignature;
  if (value.version !== 1 || !Array.isArray(value.strokes) || !value.strokes.length || value.strokes.length > 64) throw new Error("Invalid signature");
  let count = 0, distance = 0;
  const strokes = value.strokes.map(stroke => {
    if (!Array.isArray(stroke) || stroke.length < 2) throw new Error("Draw your signature");
    return stroke.map((point, i): [number, number] => {
      if (++count > 4000 || !Array.isArray(point) || point.length !== 2 || !point.every(Number.isSafeInteger) || point[0] < 0 || point[0] > 1000 || point[1] < 0 || point[1] > 300) throw new Error("Invalid signature");
      if (i) distance += Math.hypot(point[0] - stroke[i-1][0], point[1] - stroke[i-1][1]);
      return [point[0], point[1]];
    });
  });
  if (distance < 20) throw new Error("Draw your signature");
  return { version: 1, strokes };
}
