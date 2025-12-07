from PIL import Image, ImageDraw
import os

def generate_znd_assets():
    # 1. Configuration (The Anchor Point Concept)
    bg_color = '#ffffff'   # White Background
    text_color = '#000000' # Black Text
    accent_color = '#4f46e5' # Indigo Square
    
    # 2. Draw Master Image (512x512)
    size = (512, 512)
    img = Image.new('RGB', size, color=bg_color)
    d = ImageDraw.Draw(img)
    
    # Dimensions based on 512px canvas
    # 'Z' Geometry
    margin_x = 75
    margin_y = 100
    w = 300
    h = 312
    thickness = 80
    
    # Draw Z
    # Top Bar
    d.rectangle([margin_x, margin_y, margin_x + w, margin_y + thickness], fill=text_color)
    # Bottom Bar
    d.rectangle([margin_x, margin_y + h - thickness, margin_x + w, margin_y + h], fill=text_color)
    # Diagonal
    d.polygon([
        (margin_x + w, margin_y), 
        (margin_x + w, margin_y + thickness + 20), 
        (margin_x, margin_y + h), 
        (margin_x, margin_y + h - thickness - 20)
    ], fill=text_color)
    # Cleanup Corners
    d.rectangle([margin_x, margin_y, margin_x + w, margin_y + thickness], fill=text_color)
    d.rectangle([margin_x, margin_y + h - thickness, margin_x + w, margin_y + h], fill=text_color)

    # Draw Anchor Point (Square)
    sq_size = 70
    sq_x = margin_x + w + 30
    sq_y = margin_y + h - sq_size
    d.rectangle([sq_x, sq_y, sq_x + sq_size, sq_y + sq_size], fill=accent_color)
    
    # 3. Save Files
    # icon.png (Standard Favicon for Next.js)
    img.save('icon.png')
    print(f"✅ Generated: icon.png (512x512)")
    
    # apple-icon.png (For Mobile)
    # Resize to 180x180
    img_apple = img.resize((180, 180), resample=Image.Resampling.LANCZOS)
    img_apple.save('apple-icon.png')
    print(f"✅ Generated: apple-icon.png (180x180)")

if __name__ == "__main__":
    generate_znd_assets()
