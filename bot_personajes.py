import asyncio
from playwright.async_api import async_playwright
import os
import random

# Tonos de piel 100% válidos y verificados en el generador LPC
SKIN_TONES = ['light', 'amber', 'bronze', 'brown', 'black', 'olive', 'taupe']

OPTIONS = {
    'sex': ['male', 'female'],
    'hair': [
        'Cowlick_red', 'Cowlick_blue', 'Cowlick_black', 'Cowlick_blonde',
        'Long_black', 'Long_blonde', 'Long_red',
        'Loose_black', 'Loose_blonde', 'Loose_red',
        'Afro_black'
    ],
    'sleeves': [
        'Longsleeves_2_Overlay_tan', 'Longsleeves_2_Overlay_white', 'Longsleeves_2_Overlay_red',
        'Longsleeves_2_Overlay_blue', 'Longsleeves_2_Overlay_black'
    ],
    'jacket': [
        'Collared_coat_blue', 'Collared_coat_red', 'Collared_coat_black', 'Collared_coat_brown',
        'Tabard_white', 'Tabard_black', 'Tabard_red', 'Tabard_blue'
    ],
    'armour': [
        'Legion_iron', 'Legion_gold', 'Legion_bronze'
    ],
    'legs': [
        'Shorts_tan', 'Shorts_black', 'Shorts_brown', 'Shorts_blue',
        'Pants_black', 'Pants_green', 'Pants_brown', 'Pants_navy', 'Pants_white'
    ],
    'shoes': [
        'Basic_boots_black', 'Basic_boots_brown',
        'Basic_shoes_black', 'Basic_shoes_brown',
        'Sandals_brown', 'Sandals_black',
        'Slippers_black', 'Slippers_brown',
        'Armour_iron', 'Armour_gold', 'Armour_bronze'
    ]
}

def generar_url_aleatoria():
    base_url = "https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#"
    
    # 1. Sexo y tono de piel verificado
    sexo = random.choice(OPTIONS['sex'])
    color = random.choice(SKIN_TONES)
    
    # En el generador LPC, 'Human_Male_<color>' es el identificador universal para la cabeza humana,
    # y el generador adapta automáticamente la geometría según sea 'sex=male' o 'sex=female'.
    body = f"Body_Color_{color}"
    head = f"Human_Male_{color}"
    expression = f"Neutral_{color}"
    
    parts = [
        f"sex={sexo}",
        f"body={body}",
        f"head={head}",
        f"expression={expression}",
        # Cabello garantizado
        f"hair={random.choice(OPTIONS['hair'])}",
        # Piernas / Pantalones garantizados (para que NUNCA salgan desvestidos de abajo)
        f"legs={random.choice(OPTIONS['legs'])}",
        # Zapatos / Botas garantizados
        f"shoes={random.choice(OPTIONS['shoes'])}"
    ]
    
    # Ropa superior garantizada (para que NUNCA salgan sin ropa arriba):
    # Al menos llevará chaqueta o armadura (o ambas)
    has_jacket = random.random() > 0.3
    has_armour = random.random() > 0.3
    if not has_jacket and not has_armour:
        has_jacket = True
        
    if has_jacket:
        parts.append(f"jacket={random.choice(OPTIONS['jacket'])}")
    if has_armour:
        parts.append(f"armour={random.choice(OPTIONS['armour'])}")
    # Mangas complementarias opcionales
    if random.random() > 0.4:
        parts.append(f"sleeves={random.choice(OPTIONS['sleeves'])}")
            
    return base_url + "&".join(parts)

async def descargar_personaje_aleatorio():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        url = generar_url_aleatoria()
        print(f"Cargando la configuración: {url}")
        
        # Ignorar errores de red para no fallar de inmediato si hay algun rate limit (429) temporal
        try:
            await page.goto(url, wait_until='networkidle', timeout=60000)
        except Exception as e:
            print(f"Advertencia al cargar página: {e}")
            
        await page.wait_for_timeout(3000)
        
        output_dir = '/home/mvargasch/Documentos/dino_king/assets/characters'
        os.makedirs(output_dir, exist_ok=True)
        
        import time
        filename = f"character_{int(time.time())}.png"
        filepath = os.path.join(output_dir, filename)
        
        print(f"Descargando imagen: {filename}")
        
        # En la interfaz el boton de Spritesheet esta disponible. 
        # Intentamos buscar el boton de descarga y clickearlo.
        async with page.expect_download() as download_info:
            buttons = await page.query_selector_all('button')
            clicked = False
            for b in buttons:
                text = await b.text_content()
                if text and 'Spritesheet (PNG)' in text:
                    await b.click()
                    clicked = True
                    break
            if not clicked:
                print("No se encontró el botón de descarga. ¿Rate limit excedido (429)?")
                await browser.close()
                return
                    
        download = await download_info.value
        await download.save_as(filepath)
        print(f"¡Personaje guardado exitosamente en {filepath}!")
        
        await browser.close()

if __name__ == '__main__':
    asyncio.run(descargar_personaje_aleatorio())
