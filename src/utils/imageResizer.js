import sharp from 'sharp';
import sizeOf from 'image-size';

function getOutputImageName(sourceImage, size) {
  let extension = sourceImage.split('.').pop();
  let filenameWithoutExtension = sourceImage.substr(0, sourceImage.lastIndexOf('.')) || sourceImage;
  return `${filenameWithoutExtension}-${size.width}x${size.height}.${extension}`;
}

export function resizeAndSave(config, file) {
  let sourceImage = `${config.staticDir}/${file.name}`;

  sizeOf(sourceImage, (err, dimensions) => {
    for (let size of config.imageSizes) {
      if (size.width > dimensions.width) {
        console.log(`${size.width} is greater than actual width ${dimensions.width}`);
        continue;
      }
      let outputImageName = getOutputImageName(sourceImage, size);
      sharp(sourceImage)
        .resize(size.width, size.height, {
          position: size.crop || 'centre'
        })
        .toFile(outputImageName, (err) => {
          if (err) console.log('Error writing resized file', err);
          console.log(`Resized image from ${dimensions.width}x${dimensions.height} to ${size.width}x${size.height}`);
        });

    }
  });
}
