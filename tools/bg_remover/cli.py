#!/usr/bin/env python3
"""
Dino King - QuitaFondos CLI
Herramienta de línea de comandos para eliminar el fondo blanco de imágenes de dinosaurios.
Uso:
    python3 tools/bg_remover/cli.py <ruta_imagen> [opciones]
"""

import sys
import os
import argparse
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_erosion, gaussian_filter

def remove_white_background(
    img_path,
    tolerance=25.0,
    mode='border_only',
    clean_pockets=False,
    min_pocket_size=1000,
    choke=1,
    feather=0.8,
    trim=False,
    target_rgb=(255, 255, 255)
):
    """
    Elimina el fondo blanco preservando detalles internos como dientes, garras, brillos y piel clara.
    """
    img = Image.open(img_path).convert('RGB')
    arr = np.array(img, dtype=np.float32)
    h, w, _ = arr.shape
    
    t_r, t_g, t_b = target_rgb
    dist = np.sqrt((arr[:, :, 0] - t_r)**2 + (arr[:, :, 1] - t_g)**2 + (arr[:, :, 2] - t_b)**2)
    
    # Umbral de tolerancia de color blanco real
    is_bg = dist <= float(tolerance)
    
    if mode == 'all_white':
        bg_mask = is_bg
    else:
        # Etiquetado conexo
        labeled, num_features = label(is_bg)
        
        # Identificar regiones que tocan cualquiera de los 4 bordes exteriores
        border_labels = set()
        border_labels.update(np.unique(labeled[0, :]))
        border_labels.update(np.unique(labeled[-1, :]))
        border_labels.update(np.unique(labeled[:, 0]))
        border_labels.update(np.unique(labeled[:, -1]))
        border_labels.discard(0)
        
        bg_mask = np.isin(labeled, list(border_labels))
        
        # Solo limpiar huecos internos si el usuario lo pide explícitamente
        if mode == 'smart' and clean_pockets:
            for feat in range(1, num_features + 1):
                if feat not in border_labels:
                    sz = np.sum(labeled == feat)
                    if sz >= min_pocket_size:
                        bg_mask |= (labeled == feat)
                        
    fg_mask = ~bg_mask
    
    # Choke / De-halo para absorber artefactos de compresión JPEG en los bordes
    if choke > 0:
        fg_mask_choked = binary_erosion(fg_mask, iterations=choke)
    else:
        fg_mask_choked = fg_mask
        
    # Feathering (suavizado antialiasing)
    if feather > 0:
        alpha = gaussian_filter(fg_mask_choked.astype(np.float32), sigma=feather)
        alpha = np.clip(alpha * 1.05, 0.0, 1.0) * 255.0
    else:
        alpha = fg_mask_choked.astype(np.float32) * 255.0
        
    alpha = np.clip(alpha, 0, 255).astype(np.uint8)
    
    rgba = np.dstack([np.array(img), alpha])
    res = Image.fromarray(rgba, 'RGBA')
    
    if trim:
        bbox = res.getbbox()
        if bbox:
            res = res.crop(bbox)
            
    return res

def main():
    parser = argparse.ArgumentParser(description="Dino King - QuitaFondos CLI")
    parser.add_argument("input", help="Ruta de la imagen de entrada (ej: assets/.../amargasaurus.jpeg)")
    parser.add_argument("-o", "--output", help="Ruta de guardado (por defecto cambia extensión a .png)")
    parser.add_argument("-t", "--tolerance", type=float, default=25.0, help="Tolerancia de blanco (0 a 100, default: 25)")
    parser.add_argument("-m", "--mode", choices=['smart', 'border_only', 'all_white'], default='smart', help="Modo de recorte")
    parser.add_argument("--choke", type=int, default=1, help="Eliminación de halo JPEG (pixeles erosionados, default: 1)")
    parser.add_argument("--feather", type=float, default=0.8, help="Suavizado de bordes (sigma gaussiano, default: 0.8)")
    parser.add_argument("--trim", action="store_true", help="Recortar márgenes transparentes vacíos")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input):
        print(f"Error: No existe el archivo {args.input}")
        sys.exit(1)
        
    out_path = args.output
    if not out_path:
        base, _ = os.path.splitext(args.input)
        out_path = base + ".png"
        
    print(f"Procesando: {args.input}")
    print(f"Modo: {args.mode} | Tolerancia: {args.tolerance} | Choke: {args.choke} | Feather: {args.feather}")
    
    res = remove_white_background(
        args.input,
        tolerance=args.tolerance,
        mode=args.mode,
        choke=args.choke,
        feather=args.feather,
        trim=args.trim
    )
    
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    res.save(out_path, format="PNG")
    print(f"✅ ¡Guardado con éxito en: {out_path} ({res.size[0]}x{res.size[1]})")

if __name__ == "__main__":
    main()
