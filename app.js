"use strict";

const campaigns = [
  { id: "WINTER", icon: "❄️" }, { id: "SPRING", icon: "🌸" },
  { id: "SUMMER", icon: "☀️" }, { id: "SUMMER II", icon: "🏖️" },
  { id: "FALL", icon: "🍂" }, { id: "XMAS", icon: "🎄" }
];
const optionalAreas = ["BOH - Refrigerador 2 Puertas", "BOH - Refrigerador 1 Puerta", "BOH - Congelador 2 Puertas", "BOH - Congelador 1 Puerta", "BOH - Rack", "Barra - Refrigerador 2 Puertas", "Barra - Refrigerador 1 Puerta", "Barra - Gaveta", "Otra Área"];
const stations = [
  { code: "ESP", name: "Espresso / Mastrena", variants: 11, base: "esp" },
  { code: "CBE", name: "Bebidas Frías CBE", variants: 5, base: "cbe" },
  { code: "CBS", name: "Bebidas Frías CBS", variants: 7, base: "cbs" },
  { code: "FOOD", name: "Alimentos / Horno", variants: 6, base: "food" },
  { code: "DT", name: "Drive Thru", variants: 2, base: "dt" },
  { code: "HANDOFF", name: "Entrega", variants: 3, base: "handoff" },
  { code: "CAFE", name: "Café y Té", variants: 4, base: "cafe", label: "CAFÉ" },
  { code: "COND", name: "Condimentos", variants: 4, base: "cond" },
  { code: "CONS", name: "Consolidación", variants: 3, base: "consolidacion" },
  { code: "PROD", name: "Producción / Mesa Preparación", variants: 2, base: "produccion" },
  { code: "BOH", name: "Back of House / Preparación", variants: 1, base: "boh_prep" },
  { code: "OPCIONAL", name: "Opcional / 2 Evidencias", variants: 0, base: "optional", optional: true }
];

const STORAGE_KEY = "layout-preferences-v2";
const PHOTO_TARGETS = {
  real: { img: "realImg", empty: "realEmpty", camera: "cameraInput", attach: "attachInput" },
  opt1: { img: "optImg1", empty: "optEmpty1", camera: "optCamera1", attach: "optAttach1" },
  opt2: { img: "optImg2", empty: "optEmpty2", camera: "optCamera2", attach: "optAttach2" }
};
const $ = id => document.getElementById(id);
let selectedVariant = 0;
let installPrompt = null;
let toastTimer = null;

function getCampaign() { return campaigns.find(item => item.id === $("campaignSelect").value) || campaigns[2]; }
function getStation() { return stations.find(item => item.code === $("stationSelect").value) || stations[0]; }
function variantLabel(index = selectedVariant) {
  const station = getStation();
  const prefix = station.label || station.code;
  return `${prefix} ${String(index + 1).padStart(2, "0")}`;
}
function imagePath(index = selectedVariant) {
  return `assets/${getStation().base}_${String(index + 1).padStart(2, "0")}.jpg`;
}
function optionalName(number) {
  const input = $(`optName${number}`);
  const select = $(`optSelect${number}`);
  return input.value.trim() || select.value || `Área ${number}`;
}
function cleanFilename(value) {
  return String(value || "Tienda").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 64);
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

function placeholder(label) {
  const safeLabel = label.replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="680" viewBox="0 0 1200 680"><rect width="1200" height="680" fill="#f4f7f5"/><rect x="32" y="32" width="1136" height="616" rx="34" fill="#fff" stroke="#006241" stroke-width="8"/><text x="70" y="112" font-family="Arial" font-size="38" font-weight="700" fill="#006241">STARBUCKS | Layout Visual</text><text x="70" y="205" font-family="Arial" font-size="62" font-weight="900" fill="#006241">${safeLabel}</text><rect x="95" y="300" width="1010" height="215" rx="24" fill="#eaf4ef"/><text x="600" y="410" text-anchor="middle" font-family="Arial" font-size="32" font-weight="700" fill="#1e3932">Imagen teórica pendiente</text><text x="600" y="458" text-anchor="middle" font-family="Arial" font-size="22" fill="#1e3932">Agrega el recurso correspondiente en assets</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function populateControls() {
  campaigns.forEach(campaign => $("campaignSelect").add(new Option(`${campaign.id} ${campaign.icon}`, campaign.id)));
  stations.forEach(station => $("stationSelect").add(new Option(`${station.code} · ${station.name}`, station.code)));
  optionalAreas.forEach(area => {
    $("optSelect1").add(new Option(area, area));
    $("optSelect2").add(new Option(area, area));
  });
}

function restorePreferences() {
  const defaults = { campaign: "SUMMER", station: "ESP", store: "", variant: 0, area1: optionalAreas[0], area2: optionalAreas[1] };
  try {
    const saved = { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    $("campaignSelect").value = campaigns.some(c => c.id === saved.campaign) ? saved.campaign : defaults.campaign;
    $("stationSelect").value = stations.some(s => s.code === saved.station) ? saved.station : defaults.station;
    $("storeName").value = String(saved.store || "").slice(0, 80);
    selectedVariant = Number.isInteger(saved.variant) ? saved.variant : 0;
    $("optSelect1").value = optionalAreas.includes(saved.area1) ? saved.area1 : defaults.area1;
    $("optSelect2").value = optionalAreas.includes(saved.area2) ? saved.area2 : defaults.area2;
  } catch { Object.assign($("campaignSelect"), { value: defaults.campaign }); }
  $("optName1").value = $("optSelect1").value;
  $("optName2").value = $("optSelect2").value;
}

function savePreferences() {
  const data = { campaign: getCampaign().id, station: getStation().code, store: $("storeName").value.trim(), variant: selectedVariant, area1: $("optSelect1").value, area2: $("optSelect2").value };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* Private browsing may block storage. */ }
}

function renderCatalog() {
  const station = getStation();
  const catalog = $("catalog");
  catalog.replaceChildren();
  $("variantNavigation").classList.toggle("hidden", station.optional);
  if (station.optional) return;
  selectedVariant = Math.max(0, Math.min(selectedVariant, station.variants - 1));
  for (let index = 0; index < station.variants; index += 1) {
    const option = document.createElement("button");
    const label = variantLabel(index);
    option.type = "button";
    option.className = `thumb${index === selectedVariant ? " active" : ""}`;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(index === selectedVariant));
    option.dataset.index = String(index);
    const img = document.createElement("img");
    img.src = imagePath(index);
    img.alt = "";
    img.loading = index < 3 ? "eager" : "lazy";
    img.decoding = "async";
    img.addEventListener("error", () => { img.src = placeholder(label); }, { once: true });
    const text = document.createElement("span");
    text.textContent = label;
    option.append(img, text);
    option.addEventListener("click", () => selectVariant(index));
    catalog.append(option);
  }
  $("variantCounter").textContent = `${selectedVariant + 1} / ${station.variants}`;
  $("previousVariant").disabled = selectedVariant === 0;
  $("nextVariant").disabled = selectedVariant === station.variants - 1;
}

function selectVariant(index) {
  selectedVariant = index;
  renderCatalog();
  updateView();
  const active = $("catalog").querySelector(".thumb.active");
  active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}

function updateCompletion() {
  const station = getStation();
  const realReady = !$("realImg").classList.contains("hidden");
  const optionalReady = !$("optImg1").classList.contains("hidden") && !$("optImg2").classList.contains("hidden");
  const ready = station.optional ? optionalReady : realReady;
  $("completionTitle").textContent = ready ? "Comparación lista para exportar" : station.optional ? "Agrega las dos evidencias" : "Agrega la evidencia real";
  $("completionText").textContent = ready ? "Revisa el contenido y genera el PDF." : "Puedes exportar ahora o completar la evidencia primero.";
  $("photoStatus").textContent = realReady ? "Lista" : "Pendiente";
  $("photoStatus").classList.toggle("ready", realReady);
  $("clearRealButton").classList.toggle("hidden", !realReady);
}

function updateView() {
  const campaign = getCampaign();
  const station = getStation();
  const store = $("storeName").value.trim() || "Sin definir";
  const optional = Boolean(station.optional);
  const label = optional ? `${optionalName(1)} / ${optionalName(2)}` : variantLabel();
  $("dateLabel").textContent = formatDate();
  $("mainTitle").textContent = `Layout - ${campaign.id} ${campaign.icon}`;
  $("subTitle").textContent = `Tienda: ${store} · ${optional ? "Opcional" : "Estación"}: ${label}`;
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
  document.title = `Layout · ${label} · ${store}`;
  savePreferences();
  updateCompletion();
}

async function optimizeImage(file) {
  if (!file?.type.startsWith("image/")) throw new Error("Selecciona un archivo de imagen válido.");
  if (file.size > 20 * 1024 * 1024) throw new Error("La imagen supera el límite de 20 MB.");
  const bitmap = await createImageBitmap(file);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
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
  $(item.camera).value = "";
  $(item.attach).value = "";
  updateCompletion();
  if (announceChange) announce("Evidencia retirada.");
}

function clearAllPhotos() { Object.keys(PHOTO_TARGETS).forEach(key => clearPhoto(key, false)); }

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

async function exportPdf() {
  const button = $("exportButton");
  const station = getStation();
  const name = station.optional ? `${optionalName(1)}_${optionalName(2)}` : variantLabel();
  const filename = `Layout_${cleanFilename(name)}_${cleanFilename($("storeName").value.trim() || "Tienda")}.pdf`;
  const sheet = $("sheet");
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
      pagebreak: { mode: ["avoid-all"] }
    }).from(sheet).toPdf();
    const pdf = await worker.get("pdf");
    for (let page = pdf.internal.getNumberOfPages(); page > 1; page -= 1) pdf.deletePage(page);
    await worker.save();
    announce("PDF generado correctamente.");
  } catch (error) {
    announce(`${error.message} Se abrirá la impresión del navegador.`);
    window.print();
  } finally {
    sheet.classList.remove("pdf-export");
    document.body.classList.remove("is-exporting");
    button.disabled = false;
    button.textContent = "Exportar PDF";
  }
}

function bindEvents() {
  $("campaignSelect").addEventListener("change", updateView);
  $("storeName").addEventListener("input", updateView);
  $("stationSelect").addEventListener("change", () => { selectedVariant = 0; clearAllPhotos(); renderCatalog(); updateView(); });
  $("previousVariant").addEventListener("click", () => selectVariant(selectedVariant - 1));
  $("nextVariant").addEventListener("click", () => selectVariant(selectedVariant + 1));
  [1, 2].forEach(number => {
    $(`optSelect${number}`).addEventListener("change", event => {
      $(`optName${number}`).value = event.target.value === "Otra Área" ? "" : event.target.value;
      updateView();
    });
    $(`optName${number}`).addEventListener("input", updateView);
  });
  document.querySelectorAll("[data-photo-action]").forEach(button => button.addEventListener("click", () => {
    const { photoAction, target } = button.dataset;
    if (photoAction === "clear") clearPhoto(target);
    else $(PHOTO_TARGETS[target][photoAction]).click();
  }));
  Object.entries(PHOTO_TARGETS).forEach(([target, item]) => {
    $(item.camera).addEventListener("change", event => loadPhoto(event.target.files[0], target));
    $(item.attach).addEventListener("change", event => loadPhoto(event.target.files[0], target));
  });
  $("exportButton").addEventListener("click", exportPdf);
  $("resetButton").addEventListener("click", () => {
    if (!window.confirm("¿Reiniciar tienda, selección y evidencias de esta revisión?")) return;
    localStorage.removeItem(STORAGE_KEY);
    $("campaignSelect").value = "SUMMER"; $("stationSelect").value = "ESP"; $("storeName").value = "";
    $("optSelect1").value = optionalAreas[0]; $("optSelect2").value = optionalAreas[1];
    $("optName1").value = optionalAreas[0]; $("optName2").value = optionalAreas[1];
    selectedVariant = 0; clearAllPhotos(); renderCatalog(); updateView(); announce("Revisión reiniciada.");
  });
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; $("installButton").classList.remove("hidden"); });
  $("installButton").addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $("installButton").classList.add("hidden");
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

function init() {
  populateControls(); restorePreferences(); bindEvents(); renderCatalog(); updateView(); updateNetworkStatus(); registerServiceWorker();
}

document.addEventListener("DOMContentLoaded", init);
