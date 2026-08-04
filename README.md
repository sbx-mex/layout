# Starbucks Lay Out + Mejora Operativa

Conjunto de dos herramientas complementarias: Lay Out como función principal y Mejora Operativa Antes | Después como apoyo para documentar avances en Back, gavetas, racks u otros espacios.

## Recorrido operativo

1. Captura la tienda y selecciona campaña y estación.
2. Elige la variante desde el mini carrete visual.
3. Toca el recuadro de evidencia o arrastra la fotografía del acomodo real.
4. Amplía el layout si necesitas revisar detalles.
5. Exporta Lay Out en una sola página limpia.
6. Cuando aplique, activa Mejora Operativa, documenta uno o varios espacios y expórtalos en un PDF independiente.

La selección se conserva localmente en el dispositivo. Las fotografías se procesan en el navegador y no se envían ni se guardan de forma permanente.

## Catálogo JSON

`data/layouts.json` es la fuente única para campañas, categorías, estaciones, variantes, áreas opcionales y referencias de mejora. Su contrato formal está documentado en `data/layouts.schema.json`. Para agregar una estación:

- Usa un `code` único.
- Asigna una categoría existente.
- Define `variants` con el número exacto de imágenes.
- Define `assetBase`; las imágenes deben llamarse `assetBase_01.jpg`, `assetBase_02.jpg`, etc.
- Ejecuta la auditoría antes de publicar.

No es necesario modificar `app.js` para agregar campañas, estaciones o variantes compatibles con el esquema actual.

Mejora Operativa reutiliza la tienda y la fecha, pero conserva datos y exportación independientes. No contiene botones ni enlaces de carpetas compartidas.

## Validación y mantenimiento

```bash
node --check app.js
node --check sw.js
python tools/audit_project.py
```

Los workflows incluidos realizan dos funciones:

- `validar-proyecto.yml`: valida JSON, JavaScript, PWA, accesibilidad y recursos en cada cambio.
- `depurar-obsoletos.yml`: en modo `AUDITAR` solo genera evidencia; en modo `ELIMINAR`, con confirmación `DEPURAR_LAYOUT`, retira únicamente recursos no declarados y residuos temporales conocidos.

La depuración nunca elimina una imagen declarada en `data/layouts.json`, aunque su contenido sea idéntico al de otra estación.

## Publicación

El proyecto es estático y puede publicarse directamente con GitHub Pages. Conserva `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.json`, `data/`, `assets/` e `icons/` en la raíz.

Diseño: Jorge Alcantar Aguiar & Enrique César Flores.
