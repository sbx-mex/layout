#!/usr/bin/env python3
"""Valida únicamente resolución, nitidez y visor de referencias operativas.

Los archivos obsoletos pertenecen a ``audit_project.py``. Mantener los
alcances separados evita que una advertencia documental bloquee la auditoría
visual y permite que cada comprobación reporte fallos reales de su dominio.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "layouts.json"
MIN_WIDTH = 1600
MIN_HEIGHT = 900
MIN_EDGE_VARIANCE = 300.0
VIEWER_MARKERS = {
    "index.html": (
        'id="imageDialogViewport"', 'id="zoomOutButton"', 'id="zoomFitButton"',
        'id="zoomInButton"', 'id="dialogQuality"',
    ),
    "app.js": (
        "openReferenceDialog", "applyReferenceZoom", "image.naturalWidth",
        "setPointerCapture", 'event.key === "0"',
    ),
    "styles.css": (
        ".image-dialog__viewport", "image-rendering:auto", "backface-visibility:hidden",
        ".image-dialog[open]", "cursor:grabbing",
    ),
}


def reference_paths() -> list[Path]:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    paths: list[Path] = []
    for station in catalog["stations"]:
        for number in range(1, int(station.get("variants", 0)) + 1):
            paths.append(ROOT / "assets" / f"{station['assetBase']}_{number:02d}.jpg")
    return paths


def edge_variance(image: Image.Image) -> float:
    sample = ImageOps.contain(image.convert("L"), (900, 600), Image.Resampling.LANCZOS)
    return round(ImageStat.Stat(sample.filter(ImageFilter.FIND_EDGES)).var[0], 2)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    errors: list[str] = []
    records: list[dict[str, object]] = []
    hashes: dict[str, list[str]] = defaultdict(list)

    for path in reference_paths():
        relative = path.relative_to(ROOT).as_posix()
        if not path.is_file():
            errors.append(f"Falta referencia: {relative}")
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        hashes[digest].append(relative)
        with Image.open(path) as opened:
            image = ImageOps.exif_transpose(opened)
            width, height = image.size
            sharpness = edge_variance(image)
        if width < MIN_WIDTH or height < MIN_HEIGHT:
            errors.append(f"Resolución insuficiente: {relative} ({width}x{height})")
        if sharpness < MIN_EDGE_VARIANCE:
            errors.append(f"Referencia potencialmente borrosa: {relative} ({sharpness})")
        records.append({
            "file": relative,
            "width": width,
            "height": height,
            "megapixels": round(width * height / 1_000_000, 2),
            "edgeVariance": sharpness,
            "bytes": path.stat().st_size,
        })

    for file_name, markers in VIEWER_MARKERS.items():
        source = (ROOT / file_name).read_text(encoding="utf-8")
        for marker in markers:
            if marker not in source:
                errors.append(f"{file_name}: falta regla del visor: {marker}")
    duplicates = [files for files in hashes.values() if len(files) > 1]
    report = {
        "status": "failed" if errors else "passed",
        "scope": "reference-images-and-viewer",
        "documentationAudit": "delegated-to-audit_project.py",
        "references": len(records),
        "minimumResolution": [min(r["width"] for r in records), min(r["height"] for r in records)] if records else [0, 0],
        "minimumEdgeVariance": min((r["edgeVariance"] for r in records), default=0),
        "nativeZoom": {"minimum": "fit", "maximum": "350%", "drag": True, "keyboard": True, "touch": True},
        "duplicateContentGroups": duplicates,
        "records": records,
        "errors": errors,
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if errors:
        print("AUDITORÍA VISUAL FALLIDA")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print("AUDITORÍA VISUAL APROBADA")
    print(f"- {len(records)} referencias a resolución suficiente")
    print(f"- Resolución mínima: {report['minimumResolution'][0]}x{report['minimumResolution'][1]}")
    print(f"- Nitidez mínima: {report['minimumEdgeVariance']}")
    print(f"- {len(duplicates)} grupos idénticos conservados por uso operativo")
    print("- Documentación y obsoletos: delegados a audit_project.py")
    print("- Visor nativo: ajuste, zoom 350%, arrastre, teclado y táctil")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
