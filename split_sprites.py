import os
from PIL import Image

def split_spritesheet(image_path, output_dir, tile_width=16, tile_height=16):
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Open the image
    img = Image.open(image_path)
    img = img.convert("RGBA")
    
    img_width, img_height = img.size
    
    cols = img_width // tile_width
    rows = img_height // tile_height
    
    count = 0
    
    for row in range(rows):
        for col in range(cols):
            left = col * tile_width
            top = row * tile_height
            right = left + tile_width
            bottom = top + tile_height
            
            # Crop the tile
            tile = img.crop((left, top, right, bottom))
            
            # Optional: Check if tile is completely transparent/empty
            # We can check the alpha channel
            alpha = tile.split()[3]
            if not alpha.getextrema() == (0, 0): # If it's not entirely 0 alpha
                tile_filename = os.path.join(output_dir, f"grass_tile_{row:02d}_{col:02d}.png")
                tile.save(tile_filename)
                count += 1
                
    print(f"Total tiles saved: {count} in {output_dir}")

if __name__ == "__main__":
    image_path = "/home/mvargasch/Documentos/dino_king/descargas/GRASS+.png"
    output_dir = "/home/mvargasch/Documentos/dino_king/assets/grass_tiles"
    
    split_spritesheet(image_path, output_dir)
