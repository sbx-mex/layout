# Starbucks Lay Out + Mejora Operativa

Conjunto de dos herramientas complementarias: Lay Out como función principal y Mejora Operativa Antes | Después como apoyo para documentar avances en Back, gavetas, racks u otros espacios.

## Recorrido operativo

1. Captura la tienda y selecciona campaña y estación.
2. Compara las variantes en el catálogo visual y elige una sin ocultar las demás.
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

Mejora Operativa reutiliza la tienda y la fecha, pero conserva datos y exportación independientes. Cada comparativo Antes/Después ocupa una página A4 y el usuario puede agregar tantas páginas como necesite. No contiene botones ni enlaces de carpetas compartidas.

El catálogo de referencias mantiene visibles todas las variantes en escritorio y usa desplazamiento horizontal en móvil. La selección activa actualiza inmediatamente la referencia mostrada y el PDF de Lay Out.

## 10 mejoras de esta versión

1. Catálogo completo y persistente en escritorio.
2. Carrete táctil compacto en móvil.
3. Cambio inmediato de modelo, título y PDF.
4. Estado activo de alto contraste sin ocultar alternativas.
5. Navegación por flechas, Inicio y Fin desde el teclado.
6. Contador dinámico de modelos y páginas.
7. Evidencia conservada al comparar otra referencia.
8. Lay Out ajustado explícitamente a una sola hoja A4.
9. Una página A4 por cada Antes/Después.
10. Auditoría Python reforzada para impedir regresiones del catálogo y las exportaciones.

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
