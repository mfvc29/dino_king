import os
from PIL import Image

def split_spritesheet(image_path, output_dir, prefix="water_tile", tile_width=16, tile_height=16):
    os.makedirs(output_dir, exist_ok=True)
    
    img = Image.open(image_path)
    img = img.convert("RGBA")
    
    img_width, img_height = img.size
    cols = img_width // tile_width
    rows = img_height // tile_height
    
    print(f"Dimensiones de la imagen: {img_width}x{img_height}")
    print(f"Cuadrícula: {cols} columnas x {rows} filas (Tiles de {tile_width}x{tile_height})")
    
    count = 0
    empty_count = 0
    
    for row in range(rows):
        for col in range(cols):
            left = col * tile_width
            top = row * tile_height
            right = left + tile_width
            bottom = top + tile_height
            
            tile = img.crop((left, top, right, bottom))
            
            # Omitir tiles que sean 100% transparentes
            alpha = tile.split()[3]
            extrema = alpha.getextrema()
            if extrema == (0, 0):
                empty_count += 1
                continue
                
            filename = f"{prefix}_{row:02d}_{col:02d}.png"
            tile_path = os.path.join(output_dir, filename)
            tile.save(tile_path)
            count += 1
            
    print(f"-> Tiles válidos generados: {count}")
    print(f"-> Tiles transparentes omitidos: {empty_count}")
    print(f"-> Guardados en: {output_dir}")
    return count

if __name__ == "__main__":
    image_path = "/home/mvargasch/Documentos/dino_king/descargas/Water+.png"
    output_dir = "/home/mvargasch/Documentos/dino_king/assets/water_tiles"
    split_spritesheet(image_path, output_dir)
