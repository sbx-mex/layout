#!/usr/bin/env python3
"""Auditor determinista para Starbucks Layouts; no modifica archivos."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
REQUIRED = ("index.html", "styles.css", "app.js", "sw.js", "manifest.json")


def fail(message: str, errors: list[str]) -> None:
    errors.append(message)


def station_assets(js: str) -> set[str]:
    pattern = re.compile(r'\{ code: "[^"]+", name: "[^"]+", variants: (\d+), base: "([^"]+)"')
    expected: set[str] = set()
    for count_raw, base in pattern.findall(js):
        for index in range(1, int(count_raw) + 1):
            expected.add(f"{base}_{index:02d}.jpg")
    return expected


def duplicate_ids(html: str) -> set[str]:
    ids = re.findall(r'\bid="([^"]+)"', html)
    return {item for item in ids if ids.count(item) > 1}


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def main() -> int:
    errors: list[str] = []
    for name in REQUIRED:
        if not (ROOT / name).is_file():
            fail(f"Falta archivo requerido: {name}", errors)

    if errors:
        print("\n".join(f"ERROR: {error}" for error in errors))
        return 1

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    js = (ROOT / "app.js").read_text(encoding="utf-8")
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    service_worker = (ROOT / "sw.js").read_text(encoding="utf-8")

    expected_assets = station_assets(js)
    actual_assets = {path.name for path in ASSETS.glob("*.jpg")}
    missing = sorted(expected_assets - actual_assets)
    unused = sorted(actual_assets - expected_assets)
    if missing:
        fail(f"Imágenes requeridas ausentes: {', '.join(missing)}", errors)
    if unused:
        fail(f"Imágenes sin uso comprobable: {', '.join(unused)}", errors)
    duplicates = duplicate_ids(html)
    if duplicates:
        fail(f"IDs HTML duplicados: {', '.join(sorted(duplicates))}", errors)
    for required_id in ("workspace", "storeName", "campaignSelect", "stationSelect", "catalog", "sheet", "exportButton"):
        if f'id="{required_id}"' not in html:
            fail(f"Control principal ausente: #{required_id}", errors)
    if re.search(r'\son\w+\s*=', html, flags=re.IGNORECASE):
        fail("Se detectaron eventos inline; deben administrarse desde app.js", errors)
    if '<html lang="es">' not in html or "skip-link" not in html:
        fail("Faltan metadatos o navegación accesible", errors)
    if "prefers-reduced-motion" not in css or ":focus-visible" not in css:
        fail("Faltan estilos de accesibilidad", errors)
    if "serviceWorker.register" not in js or '"sw.js"' not in js:
        fail("app.js no registra el service worker", errors)
    for shell_file in ("index.html", "styles.css", "app.js", "manifest.json"):
        if shell_file not in service_worker:
            fail(f"El shell sin conexión no incluye {shell_file}", errors)

    required_manifest = {"name", "short_name", "start_url", "scope", "display", "icons", "id"}
    absent_manifest = sorted(required_manifest - manifest.keys())
    if absent_manifest:
        fail(f"Manifest incompleto: {', '.join(absent_manifest)}", errors)
    for icon in manifest.get("icons", []):
        if not (ROOT / icon.get("src", "")).is_file():
            fail(f"Icono del manifest inexistente: {icon.get('src')}", errors)

    by_hash: dict[str, list[str]] = defaultdict(list)
    for path in sorted(ASSETS.glob("*.jpg")):
        by_hash[file_hash(path)].append(path.name)
    duplicate_groups = [names for names in by_hash.values() if len(names) > 1]

    if errors:
        print("AUDITORÍA FALLIDA")
        print("\n".join(f"- {error}" for error in errors))
        return 1

    print("AUDITORÍA APROBADA")
    print(f"- {len(expected_assets)} layouts referenciados y presentes")
    print(f"- {len(actual_assets)} imágenes totales, 0 recursos sin uso")
    print(f"- {len(duplicate_groups)} grupos de archivos idénticos informativos")
    print("- HTML, PWA, accesibilidad y navegación: correctos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
