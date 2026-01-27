let counter = 0;

export function generateStrokeId(): string {
  return `st_${Date.now().toString(36)}_${(counter++).toString(36)}`;
}
