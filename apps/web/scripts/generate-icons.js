import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputSvg = path.resolve(__dirname, '../public/favicon.svg');
const outputDir = path.resolve(__dirname, '../public/icons');

async function generateIcons() {
  if (!fs.existsSync(inputSvg)) {
    console.error('Input SVG not found:', inputSvg);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const svgBuffer = fs.readFileSync(inputSvg);

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    try {
      await sharp(svgBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toFile(outputPath);
      console.log(`Generated: ${outputPath}`);
    } catch (error) {
      console.error(`Failed to generate ${size}x${size}:`, error);
    }
  }

  // Also generate apple-touch-icon
  try {
    await sharp(svgBuffer)
      .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(path.join(outputDir, 'apple-touch-icon.png'));
    console.log('Generated: apple-touch-icon.png');
  } catch (error) {
    console.error('Failed to generate apple-touch-icon:', error);
  }

  // Generate favicon.ico (multiple sizes)
  try {
    await sharp(svgBuffer)
      .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toFile(path.resolve(__dirname, '../public/favicon.ico'));
    console.log('Generated: favicon.ico');
  } catch (error) {
    console.error('Failed to generate favicon.ico:', error);
  }

  console.log('Icon generation complete!');
}

generateIcons();