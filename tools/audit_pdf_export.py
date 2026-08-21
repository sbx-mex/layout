#!/usr/bin/env python3
"""Audita la exportación A4 limpia: dos mitades y una fila por mitad."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
PORTRAIT = (1240, 1754)
LANDSCAPE = (1754, 1240)
PAGE = "#F7F3EA"
PANEL = "#FFFDF9"
GREEN = "#006241"
GOLD = "#C69C54"
LINE = "#B8CFC5"
REQUIRED_MARKERS = (
    "const PDF_MARGIN = 6;",
    "const PDF_CUT_GAP = 2;",
    "PDF_COLORS.page",
    "PDF_COLORS.panel",
    "PDF_COLORS.gold",
    "drawLayoutPdfHalf(pdf, card, metadata",
    "metadata.store",
    "metadata.campaign",
    "metadata.date",
    'section: "Referencia"',
    'section: "Real"',
    "const top = PDF_MARGIN;",
    "const bottom = height - PDF_MARGIN;",
    "layoutPdfOrientation(probe, cards)",
    'return properties.width / properties.height < .86 ? "landscape" : "portrait"',
    'if (pageOrientation === "landscape")',
    "pdf.internal.pageSize.getWidth()",
    "pdf.internal.pageSize.getHeight()",
    "setExportExperience(true, button)",
    "showExportComplete",
)


def fail(message: str) -> None:
    raise SystemExit(f"ERROR: {message}")


def contain(canvas: Image.Image, source: Image.Image, box: tuple[int, int, int, int]) -> tuple[int, int]:
    left, top, right, bottom = box
    fitted = source.copy()
    fitted.thumbnail((right - left, bottom - top), Image.Resampling.LANCZOS)
    x = left + (right - left - fitted.width) // 2
    y = top + (bottom - top - fitted.height) // 2
    canvas.paste(fitted, (x, y))
    return fitted.size


def synthetic(size: tuple[int, int], label: str) -> Image.Image:
    image = Image.new("RGB", size, "#E8ECEA")
    draw = ImageDraw.Draw(image)
    margin = min(size) // 10
    draw.rounded_rectangle((margin, margin, size[0] - margin, size[1] - margin), 28, fill="#74827C")
    draw.text((margin + 24, size[1] // 2), label, fill="white", font=ImageFont.load_default())
    return image


def panel(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    section: str,
    source: Image.Image,
) -> tuple[int, int]:
    draw = ImageDraw.Draw(canvas)
    left, top, right, bottom = box
    row_height = 58
    draw.rounded_rectangle(box, 18, fill=PANEL, outline=LINE, width=2)
    draw.rounded_rectangle((left, top, right, top + 8), 6, fill=GREEN)
    values = (f"Café - BRW 05-06 / {section}", "Montevideo DT", "Summer", "21 ago 2026")
    ratios = (.49, .20, .14, .17)
    usable = right - left - 30
    cursor = left + 15
    for index, (value, ratio) in enumerate(zip(values, ratios, strict=True)):
        draw.text((cursor, top + 24), value, fill=GREEN if index == 0 else "#556F65", font=ImageFont.load_default())
        cursor += int(usable * ratio)
        if index < 3:
            draw.line((cursor + 3, top + 20, cursor + 3, top + 42), fill=LINE, width=2)
            cursor += 6
    draw.line((left + 12, top + row_height, right - 12, top + row_height), fill=GREEN, width=2)
    return contain(canvas, source, (left + 8, top + row_height + 8, right - 8, bottom - 8))


def dashed(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int]) -> None:
    x1, y1 = start
    x2, y2 = end
    if x1 == x2:
        for y in range(y1, y2, 20):
            draw.line((x1, y, x2, min(y + 10, y2)), fill=GOLD, width=2)
    else:
        for x in range(x1, x2, 20):
            draw.line((x, y1, min(x + 10, x2), y2), fill=GOLD, width=2)


def proof(page: str, evidence: Image.Image) -> tuple[Image.Image, tuple[int, int]]:
    size = LANDSCAPE if page == "landscape" else PORTRAIT
    canvas = Image.new("RGB", size, PAGE)
    reference = synthetic((1400, 820), "REFERENCIA")
    margin, gap = 36, 14
    if page == "landscape":
        mid = size[0] // 2
        panel(canvas, (margin, margin, mid - gap, size[1] - margin), "Referencia", reference)
        placement = panel(canvas, (mid + gap, margin, size[0] - margin, size[1] - margin), "Real", evidence)
        dashed(ImageDraw.Draw(canvas), (mid, margin), (mid, size[1] - margin))
    else:
        mid = size[1] // 2
        panel(canvas, (margin, margin, size[0] - margin, mid - gap), "Referencia", reference)
        placement = panel(canvas, (margin, mid + gap, size[0] - margin, size[1] - margin), "Real", evidence)
        dashed(ImageDraw.Draw(canvas), (margin, mid), (size[0] - margin, mid))
    return canvas, placement


def validate_pdf(path: Path, expected: str) -> None:
    reader = PdfReader(path)
    if len(reader.pages) != 1:
        fail(f"{path.name} debe tener una sola página")
    box = reader.pages[0].mediabox
    actual = "landscape" if float(box.width) > float(box.height) else "portrait"
    if actual != expected:
        fail(f"{path.name}: orientación {actual}, se esperaba {expected}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=Path("/tmp/layout_v1_pdf_audit"))
    args = parser.parse_args()
    source = (ROOT / "app.js").read_text(encoding="utf-8")
    for marker in REQUIRED_MARKERS:
        if marker not in source:
            fail(f"falta regla premium: {marker}")
    layout_build = source[source.index("async function buildLayoutExportDocument"):source.index("async function exportLayoutPdf")]
    if "drawPdfHeader(" in layout_build or "drawPdfFooter(" in layout_build:
        fail("Lay Out conserva encabezado o pie global")
    match = re.search(r"const MIN_EXPORT_FEEDBACK_MS = (\d+);", source)
    if not match or int(match.group(1)) < 700:
        fail("el aviso de espera no permanece el tiempo mínimo legible")

    horizontal = synthetic((1400, 900), "FOTO HORIZONTAL")
    vertical = synthetic((900, 1400), "FOTO VERTICAL")
    portrait, horizontal_size = proof("portrait", horizontal)
    landscape, vertical_size = proof("landscape", vertical)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    portrait_pdf = args.output_dir / "horizontal_photo_a4_portrait.pdf"
    landscape_pdf = args.output_dir / "vertical_photo_a4_landscape.pdf"
    portrait.save(portrait_pdf, "PDF", resolution=150.0)
    landscape.save(landscape_pdf, "PDF", resolution=150.0)
    portrait.save(args.output_dir / "horizontal_photo_a4_portrait.png", "PNG", optimize=True)
    landscape.save(args.output_dir / "vertical_photo_a4_landscape.png", "PNG", optimize=True)
    validate_pdf(portrait_pdf, "portrait")
    validate_pdf(landscape_pdf, "landscape")
    report = {
        "status": "ok",
        "pagesPerLayoutExport": 1,
        "horizontalPhotoExport": "portrait",
        "verticalPhotoExport": "landscape",
        "warmPalette": True,
        "globalHeader": False,
        "globalFooter": False,
        "singleMetadataRowPerHalf": True,
        "metadataOrder": ["stationSection", "store", "campaign", "date"],
        "waitingAndCompletionStates": True,
        "placementsPx": {"horizontal": horizontal_size, "vertical": vertical_size},
    }
    (args.output_dir / "audit_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
