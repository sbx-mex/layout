# Starbucks Layouts

Herramienta operativa para comparar el layout de referencia de una estación con su acomodo real y exportar una evidencia en PDF.

## Uso

1. Selecciona tienda, campaña y estación.
2. Elige la variante de layout.
3. Toma o adjunta la fotografía del acomodo real.
4. Exporta la comparación en PDF.

La selección se conserva localmente en el dispositivo. Las fotografías no se envían ni se guardan de forma permanente.

## Publicación

El proyecto es estático y puede publicarse directamente mediante GitHub Pages. Conserva `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.json`, las carpetas `assets/` e `icons/` en la raíz.

## Auditoría

Ejecuta:

```bash
python tools/audit_project.py
```

El control valida que todas las variantes declaradas tengan imagen, que no existan recursos sin uso, que el manifest y el modo sin conexión estén completos y que la interfaz conserve controles básicos de accesibilidad. GitHub Actions ejecuta la misma auditoría en cada cambio.

Diseño: Jorge Alcantar Aguiar & Enrique César Flores.
