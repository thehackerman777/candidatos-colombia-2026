#!/usr/bin/env node
/**
 * inject-refs.js — Inyecta el sistema de referencias en index.html
 * 
 * 1. Añade <link> y <script> para el sistema de referencias
 * 2. Añade data-ref a elementos clave según el contenido
 * 3. Agrega el CSS y JS embebido como fallback
 */

const fs = require('fs');
const path = require('path');

const indexPath = process.argv[2] || '/tmp/repo-analysis/index.html';
let html = fs.readFileSync(indexPath, 'utf-8');

// ===== 1. Add CSS link after existing styles =====
const cssLink = `\n  <link rel="stylesheet" href="/css/refs-system.css">`;
html = html.replace('</style>', '</style>' + cssLink);

// ===== 2. Add PDF.js CDN and refs-system.js before </body> =====
const scripts = `
  <!-- SISTEMA DE REFERENCIAS Y TRAZABILIDAD -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script src="/js/refs-system.js"></script>
`;
html = html.replace('</body>', scripts + '\n</body>');

// ===== 3. Add data-ref attributes to key content elements =====
// Strategy: map specific text patterns to ref IDs, add data-ref to parent containers

const refMappings = [
  // === PERFILES — ABELARDO ===
  { pattern: /Ningún cargo público/i, refId: 'abelardo-perfil-03', limit: null },
  { pattern: /Estadounidense.*Italiana|italiana.*estadounidense/i, refId: 'abelardo-perfil-02', limit: null },
  
  // === PERFILES — CEPEDA ===
  { pattern: /Filósofo.*Sofía.*Bulgaria|Sofía.*Bulgaria.*Filósofo/i, refId: 'cepeda-perfil-01', limit: null },
  
  // === PROGRAMAS — ABELARDO ===
  { pattern: /Con criminales no hay negociación/i, refId: 'abelardo-prog-01', limit: null },
  { pattern: /Fumigaci[óo]n.*330\.000/i, refId: 'abelardo-prog-02', limit: null },
  { pattern: /Porte de armas/i, refId: 'abelardo-prog-03', limit: null },
  { pattern: /Fin del Acuerdo de Paz|Terminar.*procesos de paz/i, refId: 'abelardo-prog-04', limit: null },
  { pattern: /Crecimiento.*7%/i, refId: 'abelardo-prog-05', limit: null },
  { pattern: /Reducir.*Estado.*1\/4|reducir.*Estado.*25%/i, refId: 'abelardo-prog-06', limit: null },
  { pattern: /Desregulaci[óo]n total/i, refId: 'abelardo-prog-07', limit: null },
  { pattern: /Eliminar ministerios|Eliminaci[óo]n de ministerios/i, refId: 'abelardo-prog-08', limit: null },
  { pattern: /Salir de.*Corte IDH|Corte IDH/i, refId: 'abelardo-prog-09', limit: null },
  { pattern: /Salir.*ONU|Naciones Unidas/i, refId: 'abelardo-prog-10', limit: null },
  { pattern: /Reanudar.*Israel/i, refId: 'abelardo-prog-11', limit: null },
  { pattern: /Aliado.*ultraderecha global|ultraderecha global/i, refId: 'abelardo-prog-12', limit: null },
  { pattern: /Reactivar.*exploraci[óo]n.*petr[óo]leo/i, refId: 'abelardo-prog-13', limit: null },
  { pattern: /Fracking permitido/i, refId: 'abelardo-prog-14', limit: null },
  { pattern: /Miner[íi]a.*oro.*cobre.*tierras raras/i, refId: 'abelardo-prog-15', limit: null },
  { pattern: /Expandir.*frontera agr[íi]cola|2M has/i, refId: 'abelardo-prog-16', limit: null },
  { pattern: /Derogar.*reforma.*Ley 2381|Derogar la reforma/i, refId: 'abelardo-prog-17', limit: null },
  { pattern: /100% de capitalizaci[óo]n individual/i, refId: 'abelardo-prog-18', limit: null },
  { pattern: /Reducir cotizaciones/i, refId: 'abelardo-prog-19', limit: null },
  { pattern: /Familia tradicional como n[úu]cleo/i, refId: 'abelardo-prog-20', limit: null },
  { pattern: /Rescate moral/i, refId: 'abelardo-prog-21', limit: null },
  
  // === PROGRAMAS — CEPEDA ===
  { pattern: /Seguridad.*derechos.*salud.*educaci[óo]n|Seguridad Humana/i, refId: 'cepeda-prog-01', limit: null },
  { pattern: /Paz con justicia social|protecci[óo]n.*l[íi]deres sociales/i, refId: 'cepeda-prog-02', limit: null },
  { pattern: /Transici[óo]n energ[ée]tica justa|Proteger Amazon[íi]a/i, refId: 'cepeda-prog-03', limit: null },
  { pattern: /Bioeconom[íi]a/i, refId: 'cepeda-prog-04', limit: null },
  { pattern: /Pol[íi]tica exterior aut[óo]noma|Autonom[íi]a.*multilateralismo/i, refId: 'cepeda-prog-05', limit: null },
  { pattern: /Defensa.*migrantes/i, refId: 'cepeda-prog-06', limit: null },
  { pattern: /Continuidad.*reformas.*Petro/i, refId: 'cepeda-prog-07', limit: null },
  { pattern: /Austeridad republicana/i, refId: 'cepeda-prog-08', limit: null },
  { pattern: /Derechos humanos como eje/i, refId: 'cepeda-prog-09', limit: null },
  { pattern: /Verdad.*Reparaci[óo]n|justicia transicional/i, refId: 'cepeda-prog-10', limit: null },
  { pattern: /Derechos sexuales y reproductivos|matrimonio igualitario/i, refId: 'cepeda-prog-11', limit: null },
  { pattern: /Lucha antirracista/i, refId: 'cepeda-prog-12', limit: null },
  { pattern: /Estado laico/i, refId: 'cepeda-prog-13', limit: null },
  { pattern: /Defender.*implementaci[óo]n total.*Ley 2381|Defender.*Ley 2381/i, refId: 'cepeda-prog-14', limit: null },
  { pattern: /Ampliar.*renta b[áa]sica solidaria/i, refId: 'cepeda-prog-15', limit: null },
  { pattern: /Formalizaci[óo]n laboral.*ra[íi]z/i, refId: 'cepeda-prog-16', limit: null },
  { pattern: /Sistema Nacional de Cuidado/i, refId: 'cepeda-prog-17', limit: null },
  { pattern: /Fortalecer.*BEPS/i, refId: 'cepeda-prog-18', limit: null },
  
  // === DOSSIER — ABELARDO ===
  { pattern: /David Murcia.*abogado defensor|DMG.*pir[áa]mide/i, refId: 'abelardo-dossier-dmg', limit: null },
  { pattern: /62%.*firmas.*inv[áa]lidas|firmas falsas.*62/i, refId: 'abelardo-dossier-firmas', limit: null },
  { pattern: /Maltrato animal.*Suso|gatos.*p[óo]lvora|quemar.*gatos/i, refId: 'abelardo-dossier-maltrato', limit: null },
  { pattern: /ateo.*cat[óo]lico.*2021|conversi[óo]n.*ateo.*cat[óo]lico/i, refId: 'abelardo-dossier-conversion', limit: null },
  { pattern: /jet privado.*Italia.*vino.*10\.000/i, refId: 'abelardo-dossier-lifestyle', limit: null },
  { pattern: /Salvatore Mancuso.*muchachitos|Mancuso.*Abelardo/i, refId: 'abelardo-dossier-mancuso', limit: null },
  { pattern: /Adopci[óo]n.*LGBT.*2016.*apoyaba|niños son sagrados/i, refId: 'abelardo-dossier-adopcion', limit: null },
  { pattern: /Alex Saab.*cuentas de Abelardo|dinero de Alex Saab/i, refId: 'abelardo-dossier-saab', limit: null },
  { pattern: /Jos[ée] Manuel Restrepo.*vicepresidencial/i, refId: 'abelardo-dossier-restrepo', limit: null },
  
  // === DOSSIER — CEPEDA ===
  { pattern: /comunismo colombiano.*Partido Comunista|naci[óo] y se cri[óo] en el comunismo/i, refId: 'cepeda-dossier-up', limit: null },
  { pattern: /Ra[úu]l Reyes.*compa[ñn]ero|computadores de Ra[úu]l Reyes/i, refId: 'cepeda-dossier-farc', limit: null },
  { pattern: /Cuba.*Checoslovaquia.*Bulgaria|exilio.*Cuba.*Praga/i, refId: 'cepeda-dossier-exilio', limit: null },
  { pattern: /Caso Uribe.*Monsalve|investig[óo].*paramilitarismo.*Antioquia/i, refId: 'cepeda-dossier-uribe', limit: null },
  { pattern: /padre asesinado.*9 de agosto|Manuel Cepeda.*asesinado.*1994/i, refId: 'cepeda-dossier-padre', limit: null },
  { pattern: /Nicol[áa]s Maduro.*2013.*respald[óo]/i, refId: 'cepeda-dossier-maduro', limit: null },
  { pattern: /Nac[íi] en pol[íi]tica en el Partido Comunista/i, refId: 'cepeda-dossier-transformacion', limit: null },
];

// Find and wrap specific text with data-ref markers
for (const mapping of refMappings) {
  let count = 0;
  let match;
  
  // Reset regex lastIndex
  mapping.pattern.lastIndex = 0;
  
  while ((match = mapping.pattern.exec(html)) !== null) {
    const idx = match.index;
    const matchedText = match[0];
    
    // Don't add ref to elements that already have one
    const before = html.substring(Math.max(0, idx - 50), idx);
    if (before.includes('data-ref=')) {
      continue;
    }
    
    // Find the nearest block-level ancestor to wrap
    // Look backwards for <li>, <p>, <div class="cmp-box", etc.
    const preContext = html.substring(Math.max(0, idx - 200), idx);
    
    let insertPos = idx;
    let wrapper = '';
    
    // If we're inside a <li>, add data-ref to the <li>
    const liMatch = preContext.match(/<li[^>]*>([^<]*)$/);
    if (liMatch) {
      // Add data-ref to existing li
      const liStart = preContext.lastIndexOf('<li');
      insertPos = idx - (preContext.length - liStart);
      const liTag = html.substring(insertPos, html.indexOf('>', insertPos) + 1);
      if (!liTag.includes('data-ref=')) {
        const newLiTag = liTag.replace('<li', `<li data-ref="${mapping.refId}"`);
        html = html.substring(0, insertPos) + newLiTag + html.substring(insertPos + liTag.length);
        count++;
      }
      mapping.pattern.lastIndex = insertPos + 1;
      continue;
    }
    
    // If we're inside a <p> that isn't already ref'd
    const pMatch = preContext.match(/<p[^>]*>([^<]*)$/);
    if (pMatch) {
      const pStart = preContext.lastIndexOf('<p');
      insertPos = idx - (preContext.length - pStart);
      const pTag = html.substring(insertPos, html.indexOf('>', insertPos) + 1);
      if (!pTag.includes('data-ref=')) {
        const newPTag = pTag.replace('<p', `<p data-ref="${mapping.refId}"`);
        html = html.substring(0, insertPos) + newPTag + html.substring(insertPos + pTag.length);
        count++;
      }
      mapping.pattern.lastIndex = insertPos + 1;
      continue;
    }
    
    // If it's in a table cell
    const tdMatch = preContext.match(/<td[^>]*>([^<]*)$/);
    if (tdMatch) {
      const tdStart = preContext.lastIndexOf('<td');
      insertPos = idx - (preContext.length - tdStart);
      const tdTag = html.substring(insertPos, html.indexOf('>', insertPos) + 1);
      if (!tdTag.includes('data-ref=')) {
        const newTdTag = tdTag.replace('<td', `<td data-ref="${mapping.refId}"`);
        html = html.substring(0, insertPos) + newTdTag + html.substring(insertPos + tdTag.length);
        count++;
      }
      mapping.pattern.lastIndex = insertPos + 1;
      continue;
    }
    
    // Fallback: wrap matched text with a span
    if (count === 0) {
      const beforeTag = matchedText.length;
      const wrapper = `<span data-ref="${mapping.refId}" style="display:inline;">${matchedText}</span>`;
      html = html.substring(0, idx) + wrapper + html.substring(idx + matchedText.length);
      count++;
      mapping.pattern.lastIndex = idx + wrapper.length;
    }
  }
  
  if (count > 0) {
    console.log(`[Inject] ${mapping.refId}: ${count} match(es)`);
  }
}

// ===== 4. Save =====
fs.writeFileSync(indexPath, html, 'utf-8');
console.log(`\n[Done] Injected reference system into ${indexPath}`);
console.log(`       File size: ${(html.length / 1024).toFixed(1)} KB`);
