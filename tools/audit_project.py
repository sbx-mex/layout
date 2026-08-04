#!/usr/bin/env python3
"""Audita Starbucks Layouts y, bajo confirmación externa, retira residuos seguros."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
DATA_FILE = ROOT / "data" / "layouts.json"
REQUIRED = (
    "index.html",
    "styles.css",
    "app.js",
    "vendor/jspdf.umd.min.js",
    "sw.js",
    "manifest.json",
    "data/layouts.json",
    "data/layouts.schema.json",
    "assets/juntemonos-mas.png",
)
GENERATED_DIRS = ("tools/__pycache__", "playwright-report", "test-results")
OBSOLETE_FILES = ("README.txt",)
VISUAL_SELECTOR_IDS = {
    "referenceSelector",
    "catalogHint",
    "activeReferenceMessage",
    "compareReferenceReel",
    "comparePrevious",
    "compareNext",
    "toggleImprovementButton",
    "improvementContent",
    "maxminReferenceReel",
    "improvementList",
    "exportButton",
    "editReferenceButton",
    "exportImprovementButton",
    "improvementMeta",
    "improvementPageCount",
    "layoutWorkspace",
    "layoutToolButton",
    "improvementToolButton",
}


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def duplicate_ids(html: str) -> set[str]:
    ids = re.findall(r'\bid="([^"]+)"', html)
    return {item for item in ids if ids.count(item) > 1}


def referenced_dom_ids(js: str) -> set[str]:
    return set(re.findall(r'\$\("([A-Za-z][A-Za-z0-9_-]*)"\)', js))


def load_json(path: Path, errors: list[str]) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"JSON inválido en {path.relative_to(ROOT)}: {exc}")
        return {}


def validate_catalog(data: dict, errors: list[str]) -> set[str]:
    if data.get("$schema") != "./layouts.schema.json":
        errors.append("data/layouts.json debe declarar ./layouts.schema.json")
    if data.get("schemaVersion") != 1:
        errors.append("data/layouts.json debe usar schemaVersion 1")
    campaigns = data.get("campaigns")
    categories = data.get("stationCategories")
    stations = data.get("stations")
    optional_areas = data.get("optionalAreas")
    improvement = data.get("improvementModule")
    for name, value in (("campaigns", campaigns), ("stationCategories", categories), ("stations", stations), ("optionalAreas", optional_areas)):
        if not isinstance(value, list) or not value:
            errors.append(f"El catálogo requiere una lista no vacía: {name}")
    if not isinstance(improvement, dict):
        errors.append("El catálogo requiere improvementModule")
    if errors:
        return set()

    campaign_ids = [item.get("id") for item in campaigns]
    category_ids = [item.get("id") for item in categories]
    station_codes = [item.get("code") for item in stations]
    if len(campaign_ids) != len(set(campaign_ids)):
        errors.append("Existen campañas duplicadas")
    if len(category_ids) != len(set(category_ids)):
        errors.append("Existen categorías de estación duplicadas")
    if len(station_codes) != len(set(station_codes)):
        errors.append("Existen códigos de estación duplicados")

    expected_assets = {"juntemonos-mas.png"}
    optional_count = 0
    for position, station in enumerate(stations, start=1):
        required = ("code", "name", "shortName", "category", "variants", "assetBase")
        absent = [key for key in required if key not in station]
        if absent:
            errors.append(f"Estación #{position} incompleta: {', '.join(absent)}")
            continue
        if station["category"] not in category_ids:
            errors.append(f"{station['code']}: categoría inexistente {station['category']}")
        if not isinstance(station["variants"], int) or station["variants"] < 0:
            errors.append(f"{station['code']}: variants debe ser entero mayor o igual a cero")
            continue
        if station.get("optional"):
            optional_count += 1
            if station["variants"] != 0:
                errors.append(f"{station['code']}: una estación opcional no debe declarar layouts")
        elif station["variants"] < 1:
            errors.append(f"{station['code']}: debe declarar al menos un layout")
        for index in range(1, station["variants"] + 1):
            expected_assets.add(f"{station['assetBase']}_{index:02d}.jpg")
    if optional_count != 1:
        errors.append("Debe existir exactamente una opción de evidencias libres")
    if len(optional_areas) != len(set(optional_areas)):
        errors.append("Existen áreas opcionales duplicadas")
    improvement_areas = improvement.get("areas", [])
    references = improvement.get("references", [])
    if not improvement.get("title") or not isinstance(improvement_areas, list) or not improvement_areas:
        errors.append("improvementModule requiere título y áreas")
    if len(improvement_areas) != len(set(improvement_areas)):
        errors.append("Existen áreas de mejora duplicadas")
    if not isinstance(references, list) or not references:
        errors.append("improvementModule requiere referencias visuales")
    reference_ids: list[str] = []
    for reference in references:
        if not all(reference.get(key) for key in ("id", "title", "src")):
            errors.append("Cada referencia de mejora requiere id, title y src")
            continue
        reference_ids.append(reference["id"])
        source = reference["src"]
        if not source.startswith("assets/maxmin/"):
            errors.append(f"Referencia de mejora fuera de assets/maxmin: {source}")
        else:
            expected_assets.add(source.removeprefix("assets/"))
    if len(reference_ids) != len(set(reference_ids)):
        errors.append("Existen IDs de referencia de mejora duplicados")
    return expected_assets


def remove_safe_residue(unused_assets: list[Path]) -> list[str]:
    removed: list[str] = []
    for path in unused_assets:
        resolved = path.resolve()
        if not resolved.is_relative_to(ASSETS.resolve()) or not path.is_file():
            continue
        path.unlink()
        removed.append(path.relative_to(ROOT).as_posix())
    for relative in GENERATED_DIRS:
        path = ROOT / relative
        if path.is_dir():
            shutil.rmtree(path)
            removed.append(f"{relative}/")
    for relative in OBSOLETE_FILES:
        path = ROOT / relative
        if path.is_file():
            path.unlink()
            removed.append(relative)
    return removed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prune", action="store_true", help="Elimina solo assets no declarados y carpetas temporales conocidas")
    parser.add_argument("--report", type=Path, help="Guarda un reporte JSON de la auditoría")
    args = parser.parse_args()

    errors: list[str] = []
    for name in REQUIRED:
        if not (ROOT / name).is_file():
            errors.append(f"Falta archivo requerido: {name}")
    if errors:
        print("AUDITORÍA FALLIDA")
        print("\n".join(f"- {error}" for error in errors))
        return 1

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    js = (ROOT / "app.js").read_text(encoding="utf-8")
    manifest = load_json(ROOT / "manifest.json", errors)
    catalog = load_json(DATA_FILE, errors)
    service_worker = (ROOT / "sw.js").read_text(encoding="utf-8")
    expected_assets = validate_catalog(catalog, errors)

    actual_assets = {path.relative_to(ASSETS).as_posix(): path for path in ASSETS.rglob("*") if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}}
    missing = sorted(expected_assets - actual_assets.keys())
    unused_names = sorted(actual_assets.keys() - expected_assets)
    unused_assets = [actual_assets[name] for name in unused_names]
    obsolete_files = [relative for relative in OBSOLETE_FILES if (ROOT / relative).is_file()]
    if missing:
        errors.append(f"Recursos requeridos ausentes: {', '.join(missing)}")

    duplicates = duplicate_ids(html)
    if duplicates:
        errors.append(f"IDs HTML duplicados: {', '.join(sorted(duplicates))}")
    html_ids = set(re.findall(r'\bid="([^"]+)"', html))
    missing_visual_selector = sorted(VISUAL_SELECTOR_IDS - html_ids)
    if missing_visual_selector:
        errors.append(f"Selector visual incompleto: {', '.join(missing_visual_selector)}")
    missing_dom = sorted(referenced_dom_ids(js) - html_ids)
    if missing_dom:
        errors.append(f"app.js referencia controles HTML inexistentes: {', '.join(missing_dom)}")
    if re.search(r'\son\w+\s*=', html, flags=re.IGNORECASE):
        errors.append("Se detectaron eventos inline; deben administrarse desde app.js")
    forbidden_sharing = ("sharepoint", "compartir pdf", "abrir carpeta de carga")
    combined_source = f"{html}\n{js}".lower()
    detected_sharing = [term for term in forbidden_sharing if term in combined_source]
    if detected_sharing:
        errors.append(f"Persisten enlaces o acciones compartidas: {', '.join(detected_sharing)}")
    forbidden_interface = ("cambiar selección", "uso operativo", "paso 3")
    detected_interface = [term for term in forbidden_interface if term in combined_source]
    if detected_interface:
        errors.append(f"Persisten instrucciones o botones redundantes: {', '.join(detected_interface)}")
    if 'id="catalog"' in html or 'id="variantNavigation"' in html:
        errors.append("Persisten dos selectores de referencia; debe existir un solo carrete")
    if html.count('id="compareReferenceReel"') != 1:
        errors.append("Debe existir exactamente un carrete de Lay Out")
    if "Todas las opciones permanecen visibles" not in html or "grid-template-columns:repeat(auto-fit" not in css:
        errors.append("El carrete no funciona como catálogo dinámico visible")
    if 'id="variantSelect"' in html or 'id="variantCounter"' in html:
        errors.append("Persisten la lista desplegable o el contador redundante del catálogo")
    if '$("variantSelect")' in js or '$("variantCounter")' in js:
        errors.append("app.js conserva dependencias del selector redundante")
    if "Selecciona cualquier imagen para verla debajo" not in html:
        errors.append("El catálogo no comunica que cada miniatura actualiza el modelo")
    if 'selectedVariant = (Number(index) + station.variants) % station.variants' not in js:
        errors.append("La navegación del catálogo no funciona en ciclo continuo")
    if "bindReferenceSwipe" not in js:
        errors.append("Falta navegación táctil sobre el modelo de referencia")
    if 'href="https://wa.me/message/ENKDSAHYHIGAN1"' not in html:
        errors.append("Falta el enlace de Comentarios y/o Sugerencias")
    for action in ("camera", "attach", "delete"):
        if f'data-photo-action="{action}"' not in html:
            errors.append(f"Falta acción fotográfica: {action}")
    if "@media print" not in css or 'body[data-active-tool="layout"]' not in css:
        errors.append("Guardar como PDF desde el navegador no está protegido por herramienta activa")
    if '<html lang="es">' not in html or "skip-link" not in html:
        errors.append("Faltan metadatos o navegación accesible")
    if "prefers-reduced-motion" not in css or ":focus-visible" not in css:
        errors.append("Faltan estilos de accesibilidad")
    if DATA_FILE.name not in service_worker or DATA_URL_LITERAL not in js:
        errors.append("El catálogo JSON no está conectado a la app y al modo sin conexión")
    if "serviceWorker.register" not in js or '"sw.js"' not in js:
        errors.append("app.js no registra el service worker")
    for behavior in ("renderCompareReferenceReel", "renderMaxMinReferences", "toggleImprovement", "setToolView", "exportLayoutPdf", "buildLayoutExportDocument", "buildImprovementExportDocument", "exportImprovementPdf"):
        if behavior not in js:
            errors.append(f"Falta comportamiento de navegación visual: {behavior}")
    if 'window.jspdf.jsPDF' not in js or 'pdf.addPage("a4", "portrait")' not in js:
        errors.append("La exportación no garantiza una página independiente por comparativo")
    if "buildLayoutExportDocument" not in js or 'format: "a4"' not in js or 'pdf.save(filename)' not in js:
        errors.append("Lay Out no garantiza un documento A4 directo de una sola página")
    if "drawPdfImageContain" not in js or "Math.min(width / properties.width, height / properties.height)" not in js:
        errors.append("Las fotografías del PDF no conservan su proporción dentro del marco")
    if "window.print()" in js:
        errors.append("La exportación conserva un fallback de impresión que puede incluir enlaces o páginas extra")
    if "html2canvas" in js or "html2pdf" in combined_source or "cdnjs.cloudflare.com" in combined_source:
        errors.append("La exportación conserva una captura HTML o dependencia remota inestable")
    if '<script defer src="vendor/jspdf.umd.min.js"></script>' not in html:
        errors.append("index.html no carga el generador PDF local")
    vendor_pdf = ROOT / "vendor" / "jspdf.umd.min.js"
    if vendor_pdf.is_file() and vendor_pdf.stat().st_size < 300_000:
        errors.append("El generador PDF local está incompleto")
    layout_export_source = js[js.find("async function buildLayoutExportDocument"):js.find("async function exportLayoutPdf")]
    if "href=" in layout_export_source or "<a " in layout_export_source or "pdf.link" in layout_export_source:
        errors.append("La superficie PDF de Lay Out contiene hipervínculos")
    adaptive_pdf_tokens = (
        "layoutPdfCardGeometry(pdf, cards[1].source)",
        "geometry.referenceHeight",
        "geometry.realY",
        "geometry.realHeight",
        'orientation = "portrait"',
        'orientation = "landscape"',
    )
    if any(token not in js for token in adaptive_pdf_tokens):
        errors.append("La hoja PDF no ajusta dinámicamente la fotografía real según su orientación")
    if 'class="reference-selector reference-selector--persistent pdf-hide"' not in html:
        errors.append("El carrete de Lay Out no está configurado como catálogo persistente")
    if "starbucks-layouts-v13-persistent-reel-pdf-fit" not in service_worker:
        errors.append("El caché PWA no garantiza la entrega de la corrección del carrete y PDF")
    if 'pdf.internal.getNumberOfPages() !== 1' not in js:
        errors.append("Lay Out no bloquea regresiones de más de una página")
    if "buildLayoutExportDocument" not in js or "buildImprovementExportDocument" not in js:
        errors.append("Las exportaciones no tienen superficies independientes")
    if 'id="layoutWorkspace"' not in html or 'data-tool-view="improvement"' not in html:
        errors.append("Lay Out y Mejora Operativa no están separados en vistas propias")
    if "improvementModule" in html[html.find('id="sheet"'):html.find('id="mejoraOperativa"')]:
        errors.append("Mejora Operativa continúa anidada dentro de Lay Out")
    for shell_file in ("index.html", "styles.css", "app.js", "manifest.json", "data/layouts.json", "vendor/jspdf.umd.min.js"):
        if shell_file not in service_worker:
            errors.append(f"El shell sin conexión no incluye {shell_file}")

    required_manifest = {"name", "short_name", "start_url", "scope", "display", "icons", "id"}
    absent_manifest = sorted(required_manifest - manifest.keys())
    if absent_manifest:
        errors.append(f"Manifest incompleto: {', '.join(absent_manifest)}")
    for icon in manifest.get("icons", []):
        if not (ROOT / icon.get("src", "")).is_file():
            errors.append(f"Icono del manifest inexistente: {icon.get('src')}")

    by_hash: dict[str, list[str]] = defaultdict(list)
    for path in sorted(ASSETS.rglob("*")):
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
            by_hash[file_hash(path)].append(path.relative_to(ASSETS).as_posix())
    duplicate_groups = [names for names in by_hash.values() if len(names) > 1]
    removed = remove_safe_residue(unused_assets) if args.prune and not errors else []

    report = {
        "status": "failed" if errors else "passed",
        "schemaVersion": catalog.get("schemaVersion"),
        "campaigns": len(catalog.get("campaigns", [])),
        "stations": len(catalog.get("stations", [])),
        "layouts": sum(station.get("variants", 0) for station in catalog.get("stations", [])),
        "maxMinReferences": len(catalog.get("improvementModule", {}).get("references", [])),
        "maxMinAreas": len(catalog.get("improvementModule", {}).get("areas", [])),
        "missingAssets": missing,
        "unusedAssets": unused_names,
        "obsoleteFiles": obsolete_files,
        "removed": removed,
        "duplicateContentGroups": duplicate_groups,
        "errors": errors,
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if errors:
        print("AUDITORÍA FALLIDA")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print("AUDITORÍA APROBADA")
    print(f"- {report['layouts']} layouts declarados en JSON y presentes")
    print(f"- {report['stations']} opciones de estación y {report['campaigns']} campañas")
    print(f"- Mejora Operativa: {report['maxMinReferences']} referencias y {report['maxMinAreas']} áreas")
    print(f"- {len(unused_names)} recursos huérfanos y {len(obsolete_files)} archivos obsoletos detectados")
    print(f"- {len(removed)} residuos eliminados de forma segura")
    print(f"- {len(duplicate_groups)} grupos idénticos conservados por tener referencias distintas")
    print("- HTML, navegación, PWA, accesibilidad y catálogo: correctos")
    return 0


DATA_URL_LITERAL = '"data/layouts.json"'


if __name__ == "__main__":
    sys.exit(main())
