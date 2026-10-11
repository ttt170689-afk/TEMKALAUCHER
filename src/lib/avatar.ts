export function isCustomAvatar(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 1000000 && /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value);
}

export async function prepareAvatar(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Выбери JPG, PNG или WebP. SVG и GIF не поддерживаются.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Максимальный размер изображения — 5 МБ.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const w = image.naturalWidth, h = image.naturalHeight;
    if (!w || !h || w > 8192 || h > 8192 || w * h > 30000000) throw new Error('Выбери изображение до 30 мегапикселей, не более 8192 пикселей по стороне.');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Браузер не поддерживает обработку изображения.');
    const side = Math.min(w, h); context.imageSmoothingQuality = 'high';
    context.drawImage(image, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 512, 512);
    const result = canvas.toDataURL('image/webp', 0.85);
    if (!isCustomAvatar(result)) throw new Error('Изображение не удалось уменьшить. Попробуй другой файл.');
    return result;
  } catch (error) {
    if (error instanceof DOMException) throw new Error('Файл изображения повреждён или не поддерживается.');
    throw error;
  } finally {URL.revokeObjectURL(url);}
}
