from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
import os

# Paths (adjust if needed)
txt_path = r"f:\\AzeezAttendanceJSFACEAPI\\YASMEEN_SULTANA_BIODATA.txt"
pdf_path = r"f:\\AzeezAttendanceJSFACEAPI\\YASMEEN_SULTANA_BIODATA.pdf"

# Ensure the text file exists
if not os.path.isfile(txt_path):
    raise FileNotFoundError(f"Text file not found: {txt_path}")

c = canvas.Canvas(pdf_path, pagesize=LETTER)
width, height = LETTER
margin = 50
y = height - margin

with open(txt_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.rstrip()
        c.setFont("Helvetica", 12)
        c.drawString(margin, y, line)
        y -= 14
        if y < margin:
            c.showPage()
            y = height - margin

c.save()
print(f"PDF generated at {pdf_path}")
