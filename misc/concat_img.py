import os
import re
from PIL import Image, ImageOps

def concat_images(image_paths, size, shape=None):
    width, height = size
    images = [
        ImageOps.fit(Image.open(path).convert("RGBA"), size, Image.Resampling.LANCZOS)
        for path in image_paths
    ]
    
    shape = shape if shape else (1, len(images))
    image_size = (width * shape[1], height * shape[0])
    image = Image.new('RGB', image_size, (255, 255, 255))
    print("Grid shape:", shape)
    for row in range(shape[0]):
        for col in range(shape[1]):
            offset = (width * col, height * row)
            idx = row * shape[1] + col
            image.paste(images[idx].convert("RGB"), offset, mask=images[idx])
    
    return image

def extract_morph_frame(path):
    match = re.search(r'morph(\d+).*frame(\d+)', path)
    if match:
        return (int(match.group(1)), int(match.group(2)))
    else:
        return (0, 0)

folder = 'images'
image_paths = sorted(
    [os.path.join(folder, f) for f in os.listdir(folder) if f.endswith('.png')],
    key=extract_morph_frame
)

image_array = image_paths[:24]
image = concat_images(image_array, (1000, 1000))
image.save('image.jpg', 'JPEG')