# 📄 Planes de Gobierno — PDFs

Este directorio contiene los planes de gobierno originales en formato PDF de los candidatos presidenciales de Colombia 2026.

## Estructura esperada

```
pdfs/
├── abelardo-plan-gobierno.pdf     # Plan de gobierno de Abelardo de la Espriella
└── cepeda-plan-gobierno.pdf       # Plan de gobierno de Iván Cepeda Castro
```

## Cómo agregar un PDF

1. Descarga el PDF del plan de gobierno desde la fuente oficial
2. Colócalo en este directorio con el nombre correspondiente
3. Actualiza `refs/registry.json` con la URL del PDF si es necesario
4. El sistema de referencias lo detectará automáticamente

## Formato recomendado

- PDF con marcadores/índice (bookmarks) para navegación
- Preferiblemente texto seleccionable (OCR si es escaneado)
- Tamaño máximo recomendado: 20 MB

## Nota

Si el PDF no está disponible, el visor integrado mostrará la ubicación exacta
de la referencia (página, capítulo, sección) para que el usuario pueda
consultar el documento original manualmente.
