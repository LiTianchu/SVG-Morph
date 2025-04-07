import os
import re
from PIL import Image, ImageOps

def concat_images(image_paths, size, shape=None):
    width, height = size
    # Ensure each image is in RGBA and then convert it to RGB with a white background when pasting
    images = [
        ImageOps.fit(Image.open(path).convert("RGBA"), size, Image.Resampling.LANCZOS)
        for path in image_paths
    ]
    
    shape = shape if shape else (1, len(images))
    image_size = (width * shape[1], height * shape[0])
    # Create a white background image
    image = Image.new('RGB', image_size, (255, 255, 255))
    print("Grid shape:", shape)
    for row in range(shape[0]):
        for col in range(shape[1]):
            offset = (width * col, height * row)
            idx = row * shape[1] + col
            # Paste using the image's alpha channel as mask so transparent areas are composited
            image.paste(images[idx].convert("RGB"), offset, mask=images[idx])
    
    return image

def extract_morph_frame(path):
    # Extracts the morph number and frame number from the filename
    # For example, "image-morph2-frame6.png"
    match = re.search(r'morph(\d+).*frame(\d+)', path)
    if match:
        return (int(match.group(1)), int(match.group(2)))
    else:
        return (0, 0)

folder = 'images'
# Sort image paths by morph number then frame number
image_paths = sorted(
    [os.path.join(folder, f) for f in os.listdir(folder) if f.endswith('.png')],
    key=extract_morph_frame
)

# Use the first 32 images if available (adjust as needed)
image_array = image_paths[:24]
# Specify the grid shape (e.g. 4 rows x 8 columns)
image = concat_images(image_array, (1000, 1000))
image.save('image.jpg', 'JPEG')