"use strict";

const DATA_URL = "data/layouts.json";
const STORAGE_KEY = "layout-preferences-v3";
const PHOTO_TARGETS = {
  real: { img: "realImg", empty: "realEmpty", input: "attachInput", camera: "cameraInput" },
  opt1: { img: "optImg1", empty: "optEmpty1", input: "optAttach1", camera: "optCamera1" },
  opt2: { img: "optImg2", empty: "optEmpty2", input: "optAttach2", camera: "optCamera2" }
};

const $ = id => document.getElementById(id);
let catalogData = null;
let campaigns = [];
let stations = [];
let optionalAreas = [];
let improvementAreas = [];
let improvementReferences = [];
let selectedVariant = 0;
let selectedImprovementReference = 0;
let improvementItems = [];
let improvementSequence = 1;
let improvementEnabled = false;
let installPrompt = null;
let toastTimer = null;
let saveTimer = null;
let preferences = {};

function getCampaign() {
  return campaigns.find(item => item.id === $("campaignSelect").value) || campaigns[0];
}

function getStation() {
  return stations.find(item => item.code === $("stationSelect").value) || stations[0];
}

function variantLabel(index = selectedVariant) {
  const station = getStation();
  const prefix = station.displayCode || station.code;
  return `${prefix} ${String(index + 1).padStart(2, "0")}`;
}

function imagePath(index = selectedVariant) {
  return `assets/${getStation().assetBase}_${String(index + 1).padStart(2, "0")}.jpg`;
}

function optionalName(number) {
  const input = $(`optName${number}`);
  const select = $(`optSelect${number}`);
  return input.value.trim() || select.value || `Área ${number}`;
}

function cleanFilename(value) {
  return String(value || "Tienda").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 64);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function formatDate() {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
}

function announce(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function jumpTo(id) {
  const target = $(id);
  if (!target || target.classList.contains("hidden")) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => target.querySelector("input, select, button, [tabindex]")?.focus({ preventScroll: true }), 450);
}

function placeholder(label) {
  const safeLabel = label.replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="680" viewBox="0 0 1200 680"><rect width="1200" height="680" fill="#f4f7f5"/><rect x="32" y="32" width="1136" height="616" rx="34" fill="#fff" stroke="#006241" stroke-width="8"/><text x="70" y="112" font-family="Arial" font-size="38" font-weight="700" fill="#006241">STARBUCKS | Layout Visual</text><text x="70" y="205" font-family="Arial" font-size="62" font-weight="900" fill="#006241">${safeLabel}</text><rect x="95" y="300" width="1010" height="215" rx="24" fill="#eaf4ef"/><text x="600" y="410" text-anchor="middle" font-family="Arial" font-size="32" font-weight="700" fill="#1e3932">Imagen teórica pendiente</text><text x="600" y="458" text-anchor="middle" font-family="Arial" font-size="22" fill="#1e3932">Agrega el recurso correspondiente en assets</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function loadCatalogData() {
  const response = await fetch(DATA_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`No fue posible cargar el catálogo (${response.status}).`);
  const data = await response.json();
  if (data.schemaVersion !== 1 || !Array.isArray(data.campaigns) || !Array.isArray(data.stations) || !Array.isArray(data.optionalAreas) || !Array.isArray(data.improvementModule?.areas) || !Array.isArray(data.improvementModule?.references)) {
    throw new Error("El catálogo JSON no cumple el esquema esperado.");
  }
  catalogData = data;
  campaigns = data.campaigns;
  stations = data.stations;
  optionalAreas = data.optionalAreas;
  improvementAreas = data.improvementModule.areas;
  improvementReferences = data.improvementModule.references;
}

function populateControls() {
  campaigns.forEach(campaign => $("campaignSelect").add(new Option(`${campaign.label} ${campaign.icon}`, campaign.id)));
  catalogData.stationCategories.forEach(category => {
    const group = document.createElement("optgroup");
    group.label = category.label;
    stations.filter(station => station.category === category.id).forEach(station => group.append(new Option(`${station.code} · ${station.name}`, station.code)));
    $("stationSelect").append(group);
  });
  optionalAreas.forEach(area => {
    $("optSelect1").add(new Option(area, area));
    $("optSelect2").add(new Option(area, area));
  });
  improvementAreas.forEach(area => $("improvementArea").add(new Option(area, area)));
  const layoutCount = stations.reduce((total, station) => total + station.variants, 0);
  $("catalogSummary").textContent = `${stations.length - 1} estaciones · ${layoutCount} layouts`;
}

function restorePreferences() {
  const defaults = { campaign: "SUMMER", station: "ESP", store: "", variant: 0, area1: optionalAreas[0], area2: optionalAreas[1], recent: [] };
  try { preferences = { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { preferences = defaults; }
  $("campaignSelect").value = campaigns.some(c => c.id === preferences.campaign) ? preferences.campaign : campaigns[0].id;
  $("stationSelect").value = stations.some(s => s.code === preferences.station) ? preferences.station : stations[0].code;
  $("storeName").value = String(preferences.store || "").slice(0, 80);
  selectedVariant = Number.isInteger(preferences.variant) ? preferences.variant : 0;
  $("optSelect1").value = optionalAreas.includes(preferences.area1) ? preferences.area1 : optionalAreas[0];
  $("optSelect2").value = optionalAreas.includes(preferences.area2) ? preferences.area2 : optionalAreas[1];
  $("optName1").value = $("optSelect1").value;
  $("optName2").value = $("optSelect2").value;
  renderRecentStations();
}

function savePreferences() {
  const data = {
    campaign: getCampaign().id,
    station: getStation().code,
    store: $("storeName").value.trim(),
    variant: selectedVariant,
    area1: $("optSelect1").value,
    area2: $("optSelect2").value,
    recent: Array.isArray(preferences.recent) ? preferences.recent.slice(0, 4) : []
  };
  preferences = data;
  $("saveStatus").textContent = "Guardando…";
  $("saveStatus").classList.remove("status--saved");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      $("saveStatus").textContent = "Guardado";
      $("saveStatus").classList.add("status--saved");
    } catch {
      $("saveStatus").textContent = "Sin guardar";
    }
  }, 220);
}

function addRecentStation(code) {
  preferences.recent = [code, ...(preferences.recent || []).filter(item => item !== code)].slice(0, 4);
  renderRecentStations();
}

function renderRecentStations() {
  const recent = (preferences.recent || []).map(code => stations.find(station => station.code === code)).filter(Boolean);
  $("recentSection").classList.toggle("hidden", recent.length === 0);
  $("recentStations").replaceChildren();
  recent.forEach(station => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent__chip";
    button.textContent = station.shortName;
    button.addEventListener("click", () => {
      $("stationSelect").value = station.code;
      selectedVariant = 0;
      clearAllPhotos();
      renderCatalog();
      updateView();
      announce(`${station.name} seleccionada.`);
    });
    $("recentStations").append(button);
  });
}

function renderCatalog() {
  const station = getStation();
  $("referenceSelector").classList.toggle("hidden", station.optional);
  if (station.optional) return;
  selectedVariant = Math.max(0, Math.min(selectedVariant, station.variants - 1));
  renderCompareReferenceReel();
}

function createReelThumb({ image, label, active, onSelect }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `reel-thumb${active ? " active" : ""}`;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", String(active));
  button.setAttribute("aria-label", `Ver ${label}`);
  const img = document.createElement("img");
  img.src = image;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  const caption = document.createElement("span");
  caption.textContent = label;
  button.append(img, caption);
  button.addEventListener("click", onSelect);
  return button;
}

function renderCompareReferenceReel() {
  const reel = $("compareReferenceReel");
  const station = getStation();
  reel.replaceChildren();
  if (station.optional) return;
  for (let index = 0; index < station.variants; index += 1) {
    reel.append(createReelThumb({
      image: imagePath(index),
      label: variantLabel(index),
      active: index === selectedVariant,
      onSelect: () => selectVariant(index)
    }));
  }
  $("comparePrevious").disabled = selectedVariant === 0;
  $("compareNext").disabled = selectedVariant === station.variants - 1;
  $("variantCounter").textContent = `${selectedVariant + 1} de ${station.variants}`;
  requestAnimationFrame(() => reel.querySelector(".active")?.scrollIntoView({ block: "nearest", inline: "center" }));
}

function renderMaxMinReferences() {
  const reel = $("maxminReferenceReel");
  reel.replaceChildren();
  selectedImprovementReference = Math.max(0, Math.min(selectedImprovementReference, improvementReferences.length - 1));
  improvementReferences.forEach((reference, index) => {
    reel.append(createReelThumb({
      image: reference.src,
      label: reference.title,
      active: index === selectedImprovementReference,
      onSelect: () => selectImprovementReference(index)
    }));
  });
  const active = improvementReferences[selectedImprovementReference];
  $("maxminReferenceImage").src = active.src;
  $("maxminReferenceImage").alt = active.title;
  $("maxminReferenceTitle").textContent = active.title;
  $("maxminReferenceCounter").textContent = `${selectedImprovementReference + 1} de ${improvementReferences.length}`;
  $("maxminPrevious").disabled = selectedImprovementReference === 0;
  $("maxminNext").disabled = selectedImprovementReference === improvementReferences.length - 1;
  requestAnimationFrame(() => reel.querySelector(".active")?.scrollIntoView({ block: "nearest", inline: "center" }));
}

function selectImprovementReference(index) {
  selectedImprovementReference = Math.max(0, Math.min(index, improvementReferences.length - 1));
  renderMaxMinReferences();
}

function improvementAreaName() {
  return $("improvementCustomArea").value.trim() || $("improvementArea").value || "Espacio operativo";
}

function improvementReady() {
  return !improvementEnabled || (improvementItems.length > 0 && improvementItems.every(item => item.before && item.after));
}

function toggleImprovement(force) {
  improvementEnabled = typeof force === "boolean" ? force : !improvementEnabled;
  $("improvementContent").classList.toggle("hidden", !improvementEnabled);
  $("toggleImprovementButton").setAttribute("aria-expanded", String(improvementEnabled));
  $("toggleImprovementButton").textContent = improvementEnabled ? "Cerrar mejora" : "Iniciar mejora";
  if (improvementEnabled && improvementItems.length === 0) addImprovement();
  updateCompletion();
}

function addImprovement() {
  improvementItems.push({ id: improvementSequence++, area: improvementAreaName(), before: null, after: null, observation: "" });
  $("improvementCustomArea").value = "";
  renderImprovementList();
  updateCompletion();
}

function improvementPhoto(item, kind, label) {
  const source = item[kind];
  return `<div class="improvement-photo${source ? " has-photo" : ""}">
    <div class="improvement-photo__head"><strong>${label}</strong><span class="pdf-hide">${source ? "Lista" : "Pendiente"}</span></div>
    <div class="improvement-photo__preview">${source ? `<img src="${source}" alt="${label} de ${escapeHtml(item.area)}">` : `<span aria-hidden="true">▣</span><small>Sin evidencia</small>`}</div>
    <div class="photo-actions pdf-hide">
      <button class="button button--photo" type="button" data-improvement-action="camera" data-improvement-kind="${kind}" data-improvement-id="${item.id}">Foto</button>
      <button class="button button--ghost" type="button" data-improvement-action="attach" data-improvement-kind="${kind}" data-improvement-id="${item.id}">Adjuntar</button>
      <button class="button button--danger" type="button" data-improvement-action="delete" data-improvement-kind="${kind}" data-improvement-id="${item.id}">Eliminar</button>
    </div>
    <input class="hidden" type="file" accept="image/*" data-improvement-file="${kind}" data-improvement-id="${item.id}">
    <input class="hidden" type="file" accept="image/*" capture="environment" data-improvement-camera="${kind}" data-improvement-id="${item.id}">
  </div>`;
}

function renderImprovementList() {
  $("improvementEmpty").classList.toggle("hidden", improvementItems.length > 0);
  $("improvementList").innerHTML = improvementItems.map((item, index) => `
    <article class="improvement-card" data-improvement-card="${item.id}">
      <div class="improvement-card__head">
        <div><span class="eyebrow">Espacio ${index + 1}</span><input aria-label="Nombre del espacio ${index + 1}" value="${escapeHtml(item.area)}" maxlength="80" data-improvement-area="${item.id}"></div>
        <button class="button button--danger pdf-hide" type="button" data-improvement-remove="${item.id}">Eliminar</button>
      </div>
      <div class="improvement-photos">
        ${improvementPhoto(item, "before", "Antes")}
        ${improvementPhoto(item, "after", "Después")}
      </div>
      <label class="improvement-note">Observación de mejora
        <textarea rows="2" maxlength="280" data-improvement-note="${item.id}" placeholder="Ej. Máximos visibles, producto identificado y acceso más rápido.">${escapeHtml(item.observation)}</textarea>
      </label>
    </article>`).join("");
}

async function loadImprovementPhoto(file, id, kind) {
  const item = improvementItems.find(candidate => candidate.id === id);
  if (!item || !file) return;
  try {
    item[kind] = await optimizeImage(file);
    renderImprovementList();
    updateCompletion();
    announce(`Evidencia ${kind === "before" ? "Antes" : "Después"} cargada.`);
  } catch (error) { announce(error.message || "No fue posible abrir la imagen."); }
}

function selectVariant(index, focus = false) {
  const station = getStation();
  selectedVariant = Math.max(0, Math.min(index, station.variants - 1));
  renderCatalog();
  updateView();
  const active = $("compareReferenceReel").querySelector(".reel-thumb.active");
  active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  if (focus) active?.focus();
}

function hasPhoto(target) {
  return !$(PHOTO_TARGETS[target].img).classList.contains("hidden");
}

function reviewReady() {
  return getStation().optional ? hasPhoto("opt1") && hasPhoto("opt2") : hasPhoto("real");
}

function updateProgress() {
  const storeReady = Boolean($("storeName").value.trim());
  const ready = reviewReady();
  document.querySelectorAll(".step-nav__item").forEach(item => {
    const step = Number(item.dataset.step);
    item.classList.toggle("complete", (step === 1 && storeReady) || (step === 2 && storeReady) || (step === 3 && ready));
    item.classList.toggle("current", !ready && ((step === 1 && !storeReady) || (step === 3 && storeReady)) || (ready && step === 3));
  });
}

function updateCompletion() {
  const station = getStation();
  const ready = reviewReady();
  $("completionTitle").textContent = ready ? "Lay Out listo para exportar" : station.optional ? "Agrega las dos evidencias" : "Agrega la evidencia real";
  $("completionText").textContent = ready ? "La exportación será limpia y de una sola página." : "Puedes tocar el área de evidencia para seleccionar una imagen.";
  $("completionIcon").textContent = ready ? "✓" : "○";
  $("completionIcon").classList.toggle("ready", ready);
  $("photoStatus").textContent = hasPhoto("real") ? "Lista" : "Pendiente";
  $("photoStatus").classList.toggle("ready", hasPhoto("real"));
  updateProgress();
}

function updateView() {
  const campaign = getCampaign();
  const station = getStation();
  const store = $("storeName").value.trim() || "Sin definir";
  const optional = Boolean(station.optional);
  const label = optional ? `${optionalName(1)} / ${optionalName(2)}` : variantLabel();
  $("dateLabel").textContent = formatDate();
  $("mainTitle").textContent = `Layout · ${campaign.label} ${campaign.icon}`;
  $("subTitle").textContent = `Tienda: ${store} · ${optional ? "Áreas" : "Estación"}: ${label}`;
  $("improvementMeta").textContent = `Tienda: ${store} · ${formatDate()}`;
  $("selectionSummary").textContent = `${store} · ${campaign.label} · ${station.shortName}`;
  $("theoryBlock").classList.toggle("hidden", optional);
  $("realBlock").classList.toggle("hidden", optional);
  $("optionalBlock1").classList.toggle("hidden", !optional);
  $("optionalBlock2").classList.toggle("hidden", !optional);
  if (optional) {
    $("optTitle1").textContent = optionalName(1);
    $("optTitle2").textContent = optionalName(2);
  } else {
    $("layoutTitle").textContent = label;
    $("realTitle").textContent = label;
    $("theoryImg").alt = `Layout teórico ${label}`;
    $("theoryImg").src = imagePath();
    $("theoryImg").onerror = () => { $("theoryImg").onerror = null; $("theoryImg").src = placeholder(label); };
  }
  renderCompareReferenceReel();
  document.title = `Layout · ${label} · ${store}`;
  savePreferences();
  updateCompletion();
}

async function imageToBitmap(file) {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally { URL.revokeObjectURL(url); }
}

async function optimizeImage(file) {
  if (!file?.type.startsWith("image/")) throw new Error("Selecciona un archivo de imagen válido.");
  if (file.size > 20 * 1024 * 1024) throw new Error("La imagen supera el límite de 20 MB.");
  const bitmap = await imageToBitmap(file);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (typeof bitmap.close === "function") bitmap.close();
  return canvas.toDataURL("image/jpeg", .86);
}

async function loadPhoto(file, target) {
  if (!file) return;
  try {
    const src = await optimizeImage(file);
    const item = PHOTO_TARGETS[target];
    $(item.img).src = src;
    $(item.img).classList.remove("hidden");
    $(item.empty).classList.add("hidden");
    updateCompletion();
    announce("Evidencia cargada y optimizada.");
  } catch (error) { announce(error.message || "No fue posible abrir la imagen."); }
}

function clearPhoto(target, announceChange = true) {
  const item = PHOTO_TARGETS[target];
  $(item.img).removeAttribute("src");
  $(item.img).classList.add("hidden");
  $(item.empty).classList.remove("hidden");
  $(item.input).value = "";
  $(item.camera).value = "";
  updateCompletion();
  if (announceChange) announce("Evidencia retirada.");
}

function clearAllPhotos() {
  Object.keys(PHOTO_TARGETS).forEach(key => clearPhoto(key, false));
}

function openTheoryDialog() {
  const dialog = $("imageDialog");
  $("dialogImage").src = $("theoryImg").src;
  $("dialogTitle").textContent = `Layout de referencia · ${variantLabel()}`;
  if (typeof dialog.showModal === "function") dialog.showModal();
}

function loadPdfLibrary() {
  if (window.html2pdf) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Sin conexión para cargar el generador de PDF."));
    document.head.append(script);
  });
}

async function exportLayoutPdf() {
  const button = $("exportButton");
  const station = getStation();
  const name = station.optional ? `${optionalName(1)}_${optionalName(2)}` : variantLabel();
  const filename = `Layout_${cleanFilename(name)}_${cleanFilename($("storeName").value.trim() || "Tienda")}.pdf`;
  const sheet = $("sheet");
  if (!reviewReady() && !window.confirm("La evidencia está incompleta. ¿Deseas exportar el Lay Out de todos modos?")) return;
  button.disabled = true;
  button.textContent = "Generando…";
  try {
    await loadPdfLibrary();
    sheet.classList.add("pdf-export");
    document.body.classList.add("is-exporting");
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const worker = window.html2pdf().set({
      margin: [.25, .25, .25, .25], filename,
      image: { type: "jpeg", quality: .96 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"], avoid: [".block"] }
    }).from(sheet).toPdf();
    await worker.save();
    announce("Lay Out exportado en una sola página.");
  } catch (error) {
    announce(`${error.message} Se abrirá la impresión del navegador.`);
    window.print();
  } finally {
    sheet.classList.remove("pdf-export");
    document.body.classList.remove("is-exporting");
    button.disabled = false;
    button.textContent = "Exportar Lay Out";
  }
}

async function exportImprovementPdf() {
  const button = $("exportImprovementButton");
  if (!improvementEnabled || improvementItems.length === 0) {
    announce("Agrega al menos un espacio de mejora antes de exportar.");
    return;
  }
  if (!improvementReady() && !window.confirm("Hay evidencia Antes o Después pendiente. ¿Deseas exportar la mejora de todos modos?")) return;
  const store = cleanFilename($("storeName").value.trim() || "Tienda");
  const filename = `Mejora_Operativa_${store}.pdf`;
  const module = $("improvementModule");
  button.disabled = true;
  button.textContent = "Generando…";
  try {
    await loadPdfLibrary();
    module.classList.add("improvement-export");
    document.body.classList.add("is-exporting");
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await window.html2pdf().set({
      margin: [.35, .35, .4, .35], filename,
      image: { type: "jpeg", quality: .96 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"], avoid: [".improvement-card"] }
    }).from(module).save();
    announce("Mejora Operativa exportada por separado.");
  } catch (error) {
    announce(`${error.message} Intenta nuevamente con conexión.`);
  } finally {
    module.classList.remove("improvement-export");
    document.body.classList.remove("is-exporting");
    button.disabled = false;
    button.textContent = "Exportar Mejora Operativa";
  }
}

function bindDropzone(element, target) {
  ["dragenter", "dragover"].forEach(type => element.addEventListener(type, event => {
    event.preventDefault();
    element.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach(type => element.addEventListener(type, event => {
    event.preventDefault();
    element.classList.remove("dragging");
  }));
  element.addEventListener("drop", event => loadPhoto(event.dataTransfer.files[0], target));
}

function bindEvents() {
  $("campaignSelect").addEventListener("change", updateView);
  $("storeName").addEventListener("input", updateView);
  $("stationSelect").addEventListener("change", () => {
    selectedVariant = 0;
    clearAllPhotos();
    addRecentStation(getStation().code);
    renderCatalog();
    updateView();
  });
  $("comparePrevious").addEventListener("click", () => selectVariant(selectedVariant - 1));
  $("compareNext").addEventListener("click", () => selectVariant(selectedVariant + 1));
  $("compareReferenceReel").addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") { event.preventDefault(); selectVariant(selectedVariant - 1, true); }
    if (event.key === "ArrowRight") { event.preventDefault(); selectVariant(selectedVariant + 1, true); }
  });
  $("toggleImprovementButton").addEventListener("click", () => toggleImprovement());
  $("addImprovementButton").addEventListener("click", addImprovement);
  $("maxminPrevious").addEventListener("click", () => selectImprovementReference(selectedImprovementReference - 1));
  $("maxminNext").addEventListener("click", () => selectImprovementReference(selectedImprovementReference + 1));
  $("maxminReferenceButton").addEventListener("click", () => {
    const active = improvementReferences[selectedImprovementReference];
    $("dialogImage").src = active.src;
    $("dialogTitle").textContent = active.title;
    if (typeof $("imageDialog").showModal === "function") $("imageDialog").showModal();
  });
  $("maxminReferenceReel").addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") { event.preventDefault(); selectImprovementReference(selectedImprovementReference - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); selectImprovementReference(selectedImprovementReference + 1); }
  });
  $("improvementList").addEventListener("click", event => {
    const remove = event.target.closest("[data-improvement-remove]");
    if (remove) improvementItems = improvementItems.filter(item => item.id !== Number(remove.dataset.improvementRemove));
    if (remove) { renderImprovementList(); updateCompletion(); }
    const action = event.target.closest("[data-improvement-action]");
    if (!action) return;
    const item = improvementItems.find(candidate => candidate.id === Number(action.dataset.improvementId));
    if (!item) return;
    const kind = action.dataset.improvementKind;
    if (action.dataset.improvementAction === "delete") {
      item[kind] = null;
      renderImprovementList();
      updateCompletion();
      announce(`Evidencia ${kind === "before" ? "Antes" : "Después"} eliminada.`);
      return;
    }
    const selector = action.dataset.improvementAction === "camera" ? "data-improvement-camera" : "data-improvement-file";
    $("improvementList").querySelector(`[${selector}="${kind}"][data-improvement-id="${item.id}"]`)?.click();
  });
  $("improvementList").addEventListener("input", event => {
    const areaId = Number(event.target.dataset.improvementArea);
    const noteId = Number(event.target.dataset.improvementNote);
    if (areaId) improvementItems.find(item => item.id === areaId).area = event.target.value;
    if (noteId) improvementItems.find(item => item.id === noteId).observation = event.target.value;
  });
  $("improvementList").addEventListener("change", event => {
    if (event.target.matches("[data-improvement-file]")) loadImprovementPhoto(event.target.files[0], Number(event.target.dataset.improvementId), event.target.dataset.improvementFile);
    if (event.target.matches("[data-improvement-camera]")) loadImprovementPhoto(event.target.files[0], Number(event.target.dataset.improvementId), event.target.dataset.improvementCamera);
  });
  [1, 2].forEach(number => {
    $(`optSelect${number}`).addEventListener("change", event => {
      $(`optName${number}`).value = event.target.value === "Otra Área" ? "" : event.target.value;
      updateView();
    });
    $(`optName${number}`).addEventListener("input", updateView);
  });
  Object.entries(PHOTO_TARGETS).forEach(([target, item]) => {
    $(item.input).addEventListener("change", event => loadPhoto(event.target.files[0], target));
    $(item.camera).addEventListener("change", event => loadPhoto(event.target.files[0], target));
  });
  document.querySelectorAll("[data-photo-action]").forEach(button => button.addEventListener("click", () => {
    const target = button.dataset.photoTarget;
    const action = button.dataset.photoAction;
    if (action === "delete") return clearPhoto(target);
    $(action === "camera" ? PHOTO_TARGETS[target].camera : PHOTO_TARGETS[target].input).click();
  }));
  bindDropzone($("realBox"), "real");
  document.querySelectorAll("[data-drop-target]").forEach(element => bindDropzone(element, element.dataset.dropTarget));
  $("realBox").addEventListener("click", () => $("attachInput").click());
  document.querySelectorAll("[data-drop-target]").forEach(element => element.addEventListener("click", () => $(PHOTO_TARGETS[element.dataset.dropTarget].input).click()));
  $("realBox").addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && !hasPhoto("real")) { event.preventDefault(); $("attachInput").click(); }
  });
  document.querySelectorAll("[data-jump]").forEach(button => button.addEventListener("click", () => jumpTo(button.dataset.jump)));
  $("startButton").addEventListener("click", () => jumpTo("configuracion"));
  $("continueButton").addEventListener("click", () => jumpTo("sheet"));
  $("exportButton").addEventListener("click", exportLayoutPdf);
  $("exportImprovementButton").addEventListener("click", exportImprovementPdf);
  $("zoomTheoryButton").addEventListener("click", openTheoryDialog);
  $("theoryImageButton").addEventListener("click", openTheoryDialog);
  $("closeDialogButton").addEventListener("click", () => $("imageDialog").close());
  $("imageDialog").addEventListener("click", event => { if (event.target === $("imageDialog")) $("imageDialog").close(); });
  $("resetButton").addEventListener("click", () => {
    if (!window.confirm("¿Reiniciar tienda, selección y evidencias de esta revisión?")) return;
    localStorage.removeItem(STORAGE_KEY);
    preferences = { recent: [] };
    $("campaignSelect").value = campaigns.find(item => item.id === "SUMMER") ? "SUMMER" : campaigns[0].id;
    $("stationSelect").value = stations[0].code;
    $("storeName").value = "";
    $("optSelect1").value = optionalAreas[0];
    $("optSelect2").value = optionalAreas[1];
    $("optName1").value = optionalAreas[0];
    $("optName2").value = optionalAreas[1];
    selectedVariant = 0;
    improvementItems = [];
    improvementEnabled = false;
    improvementSequence = 1;
    $("improvementContent").classList.add("hidden");
    $("toggleImprovementButton").setAttribute("aria-expanded", "false");
    $("toggleImprovementButton").textContent = "Iniciar mejora";
    renderImprovementList();
    renderRecentStations();
    clearAllPhotos();
    renderCatalog();
    renderMaxMinReferences();
    updateView();
    announce("Revisión reiniciada.");
  });
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    $("installButton").classList.remove("hidden");
  });
  $("installButton").addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    $("installButton").classList.add("hidden");
  });
}

function updateNetworkStatus() {
  $("networkStatus").textContent = navigator.onLine ? "En línea" : "Sin conexión";
  $("networkStatus").classList.toggle("offline", !navigator.onLine);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  try { await navigator.serviceWorker.register("sw.js", { scope: "./" }); }
  catch { announce("La instalación sin conexión no está disponible."); }
}

async function init() {
  try {
    await loadCatalogData();
    populateControls();
    restorePreferences();
    bindEvents();
    renderCatalog();
    renderMaxMinReferences();
    renderImprovementList();
    updateView();
    updateNetworkStatus();
    registerServiceWorker();
  } catch (error) {
    console.error(error);
    $("catalogSummary").textContent = "Catálogo no disponible";
    $("setupTitle").textContent = "No fue posible iniciar la herramienta";
    announce(error.message || "Error al cargar el catálogo.");
  }
}

document.addEventListener("DOMContentLoaded", init);
