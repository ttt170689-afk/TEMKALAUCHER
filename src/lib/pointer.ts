/* Глобальная позиция указателя — для всплывающих «+XP» и эффектов */
export const pointer = {
  x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
  y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
};
