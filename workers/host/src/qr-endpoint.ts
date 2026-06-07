import qrcode from 'qrcode-generator';

export function generateQRSvg(data: string): string {
  const qr = qrcode(0, 'L');
  qr.addData(data);
  qr.make();
  const count = qr.getModuleCount();
  const cellSize = Math.floor(180 / count);
  const size = cellSize * count;

  let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="100%" height="100%" fill="white"/>`;

  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (qr.isDark(y, x)) {
        svg += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="#7c3aed"/>`;
      }
    }
  }

  svg += '</svg>';
  return svg;
}
