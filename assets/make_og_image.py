# Builds frontend/public/og-image.jpg, the preview shown when a link to the site is shared.
# Author: Khadim Gueye
# Usage (from the project root): python assets/make_og_image.py

from PIL import Image, ImageDraw, ImageFont
W, H = 1200, 630
photo = Image.open("frontend/public/home/lab_53.jpg").convert("RGB")
r = max(W / photo.width, H / photo.height)
photo = photo.resize((int(photo.width * r) + 1, int(photo.height * r) + 1), Image.LANCZOS)
x = (photo.width - W) // 2
y = (photo.height - H) // 3
img = photo.crop((x, y, x + W, y + H))
img = img.convert("RGBA")
for horizontal in (True, False):
    shade = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(shade)
    for i in range(W if horizontal else H):
        k = i / (W if horizontal else H)
        a = int(245 - 175 * k) if horizontal else int(150 * k)
        d.line([(i, 0), (i, H)] if horizontal else [(0, i), (W, i)], fill=(8, 28, 60, a))
    img = Image.alpha_composite(img, shade)
d = ImageDraw.Draw(img)
bold = ImageFont.truetype("assets/Inter-ExtraBold.otf", 66)
semi = ImageFont.truetype("assets/Inter-SemiBold.otf", 30)
reg = ImageFont.truetype("assets/Inter-Medium.otf", 26)
icon = Image.open("frontend/public/icon.png").convert("RGBA").resize((72, 72), Image.LANCZOS)
img.alpha_composite(icon, (70, 70))
d.text((160, 78), "Malaria Genomic Surveillance", font=semi, fill=(255, 255, 255))
d.text((160, 116), "Ify Aniebo Lab", font=reg, fill=(159, 227, 201))
d.text((70, 270), "Tracking malaria drug", font=bold, fill=(255, 255, 255))
d.text((70, 350), "resistance across Nigeria", font=bold, fill=(159, 227, 201))
d.text((70, 470), "Genomic surveillance for treatment and diagnosis policy", font=reg, fill=(230, 238, 248))
d.text((70, 540), "Institute of Genomics and Global Health, Nigeria", font=reg, fill=(200, 214, 232))
img.convert("RGB").save("frontend/public/og-image.jpg", quality=88, optimize=True)
print(img.size)
