const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;

// Phone photos can pass 4 MB, which is more than the server accepts. A file the browser
// can't draw goes up unchanged, so the server's size and type checks still decide.
export async function shrinkImage(file) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) return file;

  try {
    const image = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
