# 🆚 Colombia 2026 — Segunda Vuelta: Abelardo vs Cepeda

Página informativa comparativa de candidatos presidenciales Colombia 2026.

## 📋 Sistema de Trazabilidad y Referencias

Este proyecto implementa un **sistema completo de trazabilidad** que permite a los usuarios rastrear cada afirmación, propuesta y dato hasta su ubicación exacta en el plan de gobierno original del candidato.

### 🎯 Objetivo

Que cualquier persona pueda:
1. **Leer una propuesta** en la plataforma
2. **Seleccionar la referencia** asociada (badge 📄 p.X)
3. **Visualizar el documento original** en el punto exacto donde se menciona

### 🏗️ Arquitectura

```
candidatos-colombia-2026/
├── index.html              # Página principal con data-ref en cada elemento
├── refs/
│   └── registry.json       # Registro central de referencias
├── js/
│   └── refs-system.js      # Visor PDF + sistema de badges interactivos
├── css/
│   └── refs-system.css     # Estilos del sistema de referencias
├── pdfs/
│   ├── abelardo-plan-gobierno.pdf  # PDF del plan de Abelardo
│   ├── cepeda-plan-gobierno.pdf    # PDF del plan de Cepeda
│   └── README.md            # Instrucciones para agregar PDFs
├── scripts/
│   └── inject-refs.js       # Script para inyectar data-ref automáticamente
└── vercel.json              # Configuración de deploy
```

### 🔍 Componentes

#### 1. Registro de Referencias (`refs/registry.json`)
Cada referencia contiene:
```json
{
  "id": "abelardo-prog-01",
  "page": 5,
  "chapter": "Ejes Programáticos",
  "section": "1. Seguridad y Orden",
  "paragraph": 3,
  "text": "\"Con criminales no hay negociación\"",
  "context": "Política de seguridad: mano dura contra el crimen"
}
```

#### 2. Badges Interactivos (`📄 p.X`)
- Aparecen junto a cada propuesta/dato
- Muestran la página exacta del PDF
- Al hacer click, muestran un tooltip con contexto
- El tooltip tiene un botón para abrir el visor PDF

#### 3. Visor PDF Integrado
- Usa **PDF.js** de Mozilla (sin dependencias externas pesadas)
- Navega directamente a la página especificada
- Resalta la sección relevante
- Teclas: ← → para navegar, Escape para cerrar
- Responsive: funciona en mobile y desktop

#### 4. Estado Sin PDF
Si el PDF no está disponible:
- Muestra información detallada de la referencia (página, capítulo, sección)
- Permite al usuario ubicar manualmente la información
- Botón para abrir fuente externa

### 📊 Cobertura Actual

| Candidato | Referencias |
|-----------|-------------|
| Abelardo  | 30 referencias (perfil, programa, dossier) |
| Cepeda    | 21 referencias (perfil, programa, dossier) |
| **Total** | **51 referencias** |

### 🚀 Agregar Nuevas Referencias

```bash
# 1. Editar refs/registry.json con la nueva referencia
# 2. Agregar data-ref="tu-ref-id" al elemento HTML
# 3. Si hay muchos cambios, usar el script automático:
node scripts/inject-refs.js
```

### 📥 Agregar PDFs

Colocar los PDFs en `pdfs/` con los nombres:
- `abelardo-plan-gobierno.pdf`
- `cepeda-plan-gobierno.pdf`

El sistema los detectará automáticamente. Si no están, mostrará la ubicación exacta de la referencia para consulta manual.

### 🔧 Tecnologías

- **PDF.js** — Visor PDF en el navegador (CDN)
- **Vanilla JS** — Sin frameworks, sin dependencias
- **CSS Grid/Flexbox** — Diseño responsive
- **Vercel** — Hosting estático

### 🗺️ Roadmap

- [ ] Integración con Claude/OpenClaw para análisis automático de PDFs
- [ ] Extracción automática de referencias mediante IA
- [ ] Resaltado contextual del texto citado dentro del PDF
- [ ] Exportación de referencias como reporte
- [ ] Comparación lado a lado de PDFs de ambos candidatos
- [ ] Marcadores/navegación por capítulos dentro del visor
