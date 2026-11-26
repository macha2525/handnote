/** ノートブック・回・ノートの名前の長さの上限 */
export const TITLE_MAX = 60;

/** 入力された名前を整える。空なら null（名前なしは受け付けない） */
export function cleanTitle(input: string): string | null {
  const s = input.replace(/[\s　]+/g, ' ').trim();
  if (!s) return null;
  return Array.from(s).slice(0, TITLE_MAX).join('');
}
