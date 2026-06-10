export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function getById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element as T;
}

export function getSelectValue(id: string): string {
  return getById<HTMLSelectElement>(id).value;
}

export function setSelectValue(id: string, value: string): void {
  getById<HTMLSelectElement>(id).value = value;
}
