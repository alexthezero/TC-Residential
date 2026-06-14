const COMPANY = {
  name: "TC Residential Solutions LLC",
  phoneOne: "(904) 442-5477",
  phoneTwo: "(859) 522-5541",
  tagline: "Residential & Commercial Property Solutions",
  services: [
    "Epoxy floor systems",
    "Tree removal/trimming",
    "Pressure washing",
    "Acrylic flooring",
    "Landscaping",
    "Interior/exterior painting"
  ]
};

const STORAGE_KEY = "tcResidentialInvoices";
const INVOICE_COUNTER_KEY = "tcResidentialNextInvoiceNumber";
const LOGO_PATH = "tc-logo.jpeg";

let beforePhotoData = "";
let afterPhotoData = "";
let activeInvoiceId = null;
let signatureDirty = false;

const $ = (id) => document.getElementById(id);

const els = {
  form: $("invoiceForm"),
  invoiceDate: $("invoiceDate"),
  invoiceBadge: $("invoiceBadge"),
  paymentStatus: $("paymentStatus"),
  partialPaymentBox: $("partialPaymentBox"),
  amountPaid: $("amountPaid"),
  customerName: $("customerName"),
  customerPhone: $("customerPhone"),
  customerEmail: $("customerEmail"),
  customerAddress: $("customerAddress"),
  servicesContainer: $("servicesContainer"),
  addServiceBtn: $("addServiceBtn"),
  totalPreview: $("totalPreview"),
  paidPreview: $("paidPreview"),
  balancePreview: $("balancePreview"),
  beforePhoto: $("beforePhoto"),
  afterPhoto: $("afterPhoto"),
  beforePreview: $("beforePreview"),
  afterPreview: $("afterPreview"),
  clearBeforePhoto: $("clearBeforePhoto"),
  clearAfterPhoto: $("clearAfterPhoto"),
  notes: $("notes"),
  signaturePad: $("signaturePad"),
  clearSignatureBtn: $("clearSignatureBtn"),
  saveInvoiceBtn: $("saveInvoiceBtn"),
  generatePdfBtn: $("generatePdfBtn"),
  resetFormBtn: $("resetFormBtn"),
  savedInvoicesList: $("savedInvoicesList")
};

function money(value) {
  const number = Number(value || 0);
  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getNextInvoiceNumber() {
  const stored = Number(localStorage.getItem(INVOICE_COUNTER_KEY));

  if (!stored || stored < 1000) {
    localStorage.setItem(INVOICE_COUNTER_KEY, "1000");
    return 1000;
  }

  return stored;
}

function setInvoiceBadge(number) {
  els.invoiceBadge.textContent = `INV-${number}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildServiceOptions(selected = "") {
  const options = [`<option value="">Choose service</option>`]
    .concat(
      COMPANY.services.map((service) => {
        const isSelected = selected === service ? "selected" : "";
        return `<option value="${service}" ${isSelected}>${service}</option>`;
      })
    )
    .join("");

  return options;
}

function addServiceRow(service = "", description = "", price = "") {
  const row = document.createElement("div");
  row.className = "service-row";

  row.innerHTML = `
    <label>
      Service
      <select class="service-type">
        ${buildServiceOptions(service)}
      </select>
    </label>

    <label>
      Description
      <input type="text" class="service-description" placeholder="Details of work performed" value="${escapeHtml(description)}" />
    </label>

    <label>
      Price
      <input type="number" class="service-price" min="0" step="0.01" placeholder="0.00" value="${price}" />
    </label>

    <button type="button" class="remove-service" aria-label="Remove service">×</button>
  `;

  row.querySelector(".remove-service").addEventListener("click", () => {
    if (els.servicesContainer.children.length > 1) {
      row.remove();
      updateTotals();
    }
  });

  row.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", updateTotals);
  });

  els.servicesContainer.appendChild(row);
  updateTotals();
}

function getServices() {
  return Array.from(els.servicesContainer.querySelectorAll(".service-row"))
    .map((row) => ({
      service: row.querySelector(".service-type").value.trim(),
      description: row.querySelector(".service-description").value.trim(),
      price: Number(row.querySelector(".service-price").value || 0)
    }))
    .filter((item) => item.service || item.description || item.price);
}

function getTotal() {
  return getServices().reduce((sum, item) => {
    return sum + Number(item.price || 0);
  }, 0);
}

function getPaidAmount(total) {
  const status = els.paymentStatus.value;

  if (status === "Paid") return total;

  if (status === "Partial") {
    return Math.min(Number(els.amountPaid.value || 0), total);
  }

  return 0;
}

function updateTotals() {
  const total = getTotal();
  const paid = getPaidAmount(total);
  const balance = Math.max(total - paid, 0);

  els.totalPreview.textContent = money(total);
  els.paidPreview.textContent = money(paid);
  els.balancePreview.textContent = money(balance);

  if (els.paymentStatus.value === "Partial") {
    els.partialPaymentBox.classList.remove("hidden");
  } else {
    els.partialPaymentBox.classList.add("hidden");
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

async function compressImage(file, maxSize = 1400, quality = 0.78) {
  const dataUrl = await readFileAsDataUrl(file);

  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.src = dataUrl;
  });
}

async function handlePhotoInput(input, previewEl, type) {
  const file = input.files && input.files[0];

  if (!file) return;

  const compressed = await compressImage(file);

  if (type === "before") beforePhotoData = compressed;
  if (type === "after") afterPhotoData = compressed;

  previewEl.src = compressed;
  previewEl.classList.remove("hidden");
}

function clearPhoto(type) {
  if (type === "before") {
    beforePhotoData = "";
    els.beforePhoto.value = "";
    els.beforePreview.src = "";
    els.beforePreview.classList.add("hidden");
  } else {
    afterPhotoData = "";
    els.afterPhoto.value = "";
    els.afterPreview.src = "";
    els.afterPreview.classList.add("hidden");
  }
}

function resizeSignatureCanvas() {
  const canvas = els.signaturePad;
  const rect = canvas.parentElement.getBoundingClientRect();

  const temp = document.createElement("canvas");
  const tempCtx = temp.getContext("2d");

  if (canvas.width && canvas.height) {
    temp.width = canvas.width;
    temp.height = canvas.height;
    tempCtx.drawImage(canvas, 0, 0);
  }

  const dpr = Math.max(window.devicePixelRatio || 1, 1);

  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);

  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  const ctx = canvas.getContext("2d");

  ctx.scale(dpr, dpr);
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#06090a";

  if (temp.width && temp.height && signatureDirty) {
    ctx.drawImage(
      temp,
      0,
      0,
      temp.width / dpr,
      temp.height / dpr,
      0,
      0,
      rect.width,
      rect.height
    );
  }
}

function initSignaturePad() {
  const canvas = els.signaturePad;
  const ctx = canvas.getContext("2d");

  let drawing = false;

  function pointerPos(event) {
    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function start(event) {
    event.preventDefault();

    drawing = true;
    signatureDirty = true;

    const pos = pointerPos(event);

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function move(event) {
    if (!drawing) return;

    event.preventDefault();

    const pos = pointerPos(event);

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function end() {
    drawing = false;
  }

  resizeSignatureCanvas();

  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);

  window.addEventListener("resize", resizeSignatureCanvas);
}

function clearSignature() {
  const canvas = els.signaturePad;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  signatureDirty = false;
}

function getSignatureData() {
  return signatureDirty ? els.signaturePad.toDataURL("image/png") : "";
}

function drawSignatureFromData(dataUrl) {
  clearSignature();

  if (!dataUrl) return;

  const img = new Image();

  img.onload = () => {
    const canvas = els.signaturePad;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0, rect.width, rect.height);

    signatureDirty = true;
  };

  img.src = dataUrl;
}

function getInvoiceData() {
  const invoiceNumber = els.invoiceBadge.textContent.replace("INV-", "");
  const total = getTotal();
  const paid = getPaidAmount(total);
  const balance = Math.max(total - paid, 0);

  return {
    id: activeInvoiceId || crypto.randomUUID(),
    invoiceNumber,
    invoiceDate: els.invoiceDate.value,
    paymentStatus: els.paymentStatus.value,
    amountPaid: paid,
    balance,
    total,
    customerName: els.customerName.value.trim(),
    customerPhone: els.customerPhone.value.trim(),
    customerEmail: els.customerEmail.value.trim(),
    customerAddress: els.customerAddress.value.trim(),
    services: getServices(),
    notes: els.notes.value.trim(),
    beforePhotoData,
    afterPhotoData,
    signatureData: getSignatureData(),
    savedAt: new Date().toISOString()
  };
}

function validateInvoice(data) {
  if (!data.invoiceDate) return "Please choose an invoice date.";
  if (!data.customerName) return "Please enter the customer name.";
  if (!data.customerAddress) return "Please enter the job address.";
  if (!data.services.length) return "Please add at least one service.";
  if (data.services.every((item) => !item.price)) return "Please add a price for at least one service.";

  return "";
}

function getSavedInvoices() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setSavedInvoices(invoices) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

function saveInvoice() {
  const data = getInvoiceData();
  const error = validateInvoice(data);

  if (error) {
    alert(error);
    return null;
  }

  const invoices = getSavedInvoices();
  const existingIndex = invoices.findIndex((invoice) => invoice.id === data.id);

  if (existingIndex >= 0) {
    invoices[existingIndex] = data;
  } else {
    invoices.unshift(data);

    const currentNext = getNextInvoiceNumber();

    if (Number(data.invoiceNumber) >= currentNext) {
      localStorage.setItem(INVOICE_COUNTER_KEY, String(Number(data.invoiceNumber) + 1));
    }
  }

  setSavedInvoices(invoices);

  activeInvoiceId = data.id;

  renderSavedInvoices();

  return data;
}

function renderSavedInvoices() {
  const invoices = getSavedInvoices();

  els.savedInvoicesList.innerHTML = "";

  if (!invoices.length) {
    els.savedInvoicesList.innerHTML = `<div class="empty-state">No saved invoices yet.</div>`;
    return;
  }

  invoices.forEach((invoice) => {
    const item = document.createElement("div");
    item.className = "saved-item";

    item.innerHTML = `
      <strong>INV-${invoice.invoiceNumber} — ${escapeHtml(invoice.customerName || "Customer")}</strong>
      <div class="saved-meta">${invoice.invoiceDate || "No date"} • ${money(invoice.total)} • ${invoice.paymentStatus}</div>
      <div class="saved-actions">
        <button type="button" class="secondary-btn load-btn">Load</button>
        <button type="button" class="primary-btn pdf-btn">PDF</button>
        <button type="button" class="danger-btn delete-btn">Delete</button>
      </div>
    `;

    item.querySelector(".load-btn").addEventListener("click", () => loadInvoice(invoice));
    item.querySelector(".pdf-btn").addEventListener("click", () => generatePdf(invoice));
    item.querySelector(".delete-btn").addEventListener("click", () => deleteInvoice(invoice.id));

    els.savedInvoicesList.appendChild(item);
  });
}

function loadInvoice(invoice) {
  activeInvoiceId = invoice.id;

  setInvoiceBadge(invoice.invoiceNumber);

  els.invoiceDate.value = invoice.invoiceDate || todayIso();
  els.paymentStatus.value = invoice.paymentStatus || "Unpaid";
  els.amountPaid.value = invoice.paymentStatus === "Partial" ? invoice.amountPaid || "" : "";

  els.customerName.value = invoice.customerName || "";
  els.customerPhone.value = invoice.customerPhone || "";
  els.customerEmail.value = invoice.customerEmail || "";
  els.customerAddress.value = invoice.customerAddress || "";
  els.notes.value = invoice.notes || "";

  els.servicesContainer.innerHTML = "";

  const services = invoice.services && invoice.services.length ? invoice.services : [{}];

  services.forEach((service) => {
    addServiceRow(service.service || "", service.description || "", service.price || "");
  });

  beforePhotoData = invoice.beforePhotoData || "";
  afterPhotoData = invoice.afterPhotoData || "";

  showLoadedPhoto(els.beforePreview, beforePhotoData);
  showLoadedPhoto(els.afterPreview, afterPhotoData);

  drawSignatureFromData(invoice.signatureData || "");

  updateTotals();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function showLoadedPhoto(preview, dataUrl) {
  if (dataUrl) {
    preview.src = dataUrl;
    preview.classList.remove("hidden");
  } else {
    preview.src = "";
    preview.classList.add("hidden");
  }
}

function deleteInvoice(id) {
  if (!confirm("Delete this saved invoice from this device?")) return;

  const invoices = getSavedInvoices().filter((invoice) => invoice.id !== id);

  setSavedInvoices(invoices);

  if (activeInvoiceId === id) {
    activeInvoiceId = null;
  }

  renderSavedInvoices();
}

function resetForm() {
  if (!confirm("Clear the current form? Saved invoices will not be deleted.")) return;

  activeInvoiceId = null;

  els.form.reset();
  els.invoiceDate.value = todayIso();

  setInvoiceBadge(getNextInvoiceNumber());

  els.servicesContainer.innerHTML = "";

  addServiceRow();

  clearPhoto("before");
  clearPhoto("after");
  clearSignature();
  updateTotals();
}

async function imageToDataUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();

  return await readFileAsDataUrl(blob);
}

function addStatusBadge(doc, status, x, y) {
  const colors = {
    Paid: [31, 122, 77],
    Partial: [202, 162, 74],
    Unpaid: [183, 53, 53]
  };

  const color = colors[status] || colors.Unpaid;

  doc.setFillColor(...color);
  doc.roundedRect(x, y, 42, 10, 4, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);

  doc.text(status.toUpperCase(), x + 21, y + 6.7, {
    align: "center"
  });
}

function safeText(doc, text, x, y, options = {}) {
  const value = String(text || "");
  doc.text(value, x, y, options);
}

function drawWrapped(doc, text, x, y, width, lineHeight = 5) {
  const lines = doc.splitTextToSize(String(text || ""), width);

  doc.text(lines, x, y);

  return y + lines.length * lineHeight;
}

function addImageContain(doc, dataUrl, x, y, maxW, maxH) {
  if (!dataUrl) return;

  const props = doc.getImageProperties(dataUrl);
  const ratio = Math.min(maxW / props.width, maxH / props.height);
  const w = props.width * ratio;
  const h = props.height * ratio;
  const centeredX = x + (maxW - w) / 2;
  const centeredY = y + (maxH - h) / 2;

  doc.addImage(dataUrl, "JPEG", centeredX, centeredY, w, h);
}

async function generatePdf(invoiceOverride = null) {
  const data = invoiceOverride || getInvoiceData();
  const error = validateInvoice(data);

  if (error) {
    alert(error);
    return;
  }

  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({
    unit: "mm",
    format: "letter"
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  const gold = [202, 162, 74];
  const black = [6, 9, 10];
  const charcoal = [52, 52, 58];
  const soft = [247, 245, 239];
  const line = [230, 223, 207];

  let logoData = "";

  try {
    logoData = await imageToDataUrl(LOGO_PATH);
  } catch (error) {
    console.warn("Logo failed to load for PDF", error);
  }

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setFillColor(...black);
  doc.rect(0, 0, pageW, 22, "F");

  doc.setFillColor(...gold);
  doc.rect(0, 22, pageW, 2.5, "F");

  if (logoData) {
    doc.addImage(logoData, "JPEG", margin, 30, 34, 34);
  }

  doc.setTextColor(...black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  safeText(doc, COMPANY.name, 54, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...charcoal);
  safeText(doc, COMPANY.tagline, 54, 45);
  safeText(doc, `${COMPANY.phoneOne}  |  ${COMPANY.phoneTwo}`, 54, 51);
  safeText(doc, COMPANY.services.join(" • "), 54, 57);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...black);
  doc.text("INVOICE", pageW - margin, 38, {
    align: "right"
  });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...charcoal);
  doc.text(`INV-${data.invoiceNumber}`, pageW - margin, 46, {
    align: "right"
  });
  doc.text(`Date: ${data.invoiceDate}`, pageW - margin, 52, {
    align: "right"
  });

  addStatusBadge(doc, data.paymentStatus, pageW - margin - 42, 57);

  doc.setDrawColor(...line);
  doc.setFillColor(...soft);
  doc.roundedRect(margin, 75, 110, 42, 4, 4, "FD");
  doc.roundedRect(132, 75, pageW - 147, 42, 4, 4, "FD");

  doc.setTextColor(...gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  safeText(doc, "BILL TO", margin + 6, 84);

  doc.setTextColor(...black);
  doc.setFontSize(12);
  safeText(doc, data.customerName, margin + 6, 92);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);

  let y = 99;

  y = drawWrapped(doc, data.customerAddress, margin + 6, y, 94, 4.5);

  if (data.customerPhone) {
    safeText(doc, data.customerPhone, margin + 6, y + 1);
  }

  if (data.customerEmail) {
    safeText(doc, data.customerEmail, margin + 6, y + 6);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...gold);
  doc.text("BALANCE", pageW - margin - 6, 84, {
    align: "right"
  });

  doc.setTextColor(...black);
  doc.setFontSize(24);
  doc.text(money(data.balance), pageW - margin - 6, 96, {
    align: "right"
  });

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...charcoal);
  doc.text(`Total: ${money(data.total)}`, pageW - margin - 6, 104, {
    align: "right"
  });
  doc.text(`Paid: ${money(data.amountPaid)}`, pageW - margin - 6, 110, {
    align: "right"
  });

  let tableY = 130;

  doc.setFillColor(...black);
  doc.roundedRect(margin, tableY, pageW - margin * 2, 10, 3, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("SERVICE", margin + 5, tableY + 6.5);
  doc.text("DESCRIPTION", margin + 58, tableY + 6.5);
  doc.text("AMOUNT", pageW - margin - 5, tableY + 6.5, {
    align: "right"
  });

  tableY += 15;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...black);

  data.services.forEach((item) => {
    if (tableY > 225) {
      doc.addPage();
      tableY = 25;
    }

    const descLines = doc.splitTextToSize(item.description || "—", 84);
    const rowHeight = Math.max(12, descLines.length * 5 + 6);

    doc.setDrawColor(...line);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, tableY - 5, pageW - margin * 2, rowHeight, 3, 3, "D");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(item.service || "Service", margin + 5, tableY + 2);

    doc.setFont("helvetica", "normal");
    doc.text(descLines, margin + 58, tableY + 2);

    doc.setFont("helvetica", "bold");
    doc.text(money(item.price), pageW - margin - 5, tableY + 2, {
      align: "right"
    });

    tableY += rowHeight + 4;
  });

  const notesY = Math.max(tableY + 6, 188);

  doc.setDrawColor(...line);
  doc.setFillColor(...soft);
  doc.roundedRect(margin, notesY, pageW - margin * 2, 30, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...gold);
  safeText(doc, "NOTES / TERMS", margin + 6, notesY + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...charcoal);

  drawWrapped(
    doc,
    data.notes || "Thank you for choosing TC Residential Solutions LLC.",
    margin + 6,
    notesY + 15,
    pageW - margin * 2 - 12,
    4.5
  );

  const sigY = pageH - 45;

  doc.setDrawColor(...line);
  doc.line(margin, sigY + 20, margin + 76, sigY + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...charcoal);
  doc.text("Customer Signature", margin, sigY + 26);

  if (data.signatureData) {
    doc.addImage(data.signatureData, "PNG", margin, sigY, 76, 18);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...black);
  doc.text(COMPANY.name, pageW - margin, sigY + 10, {
    align: "right"
  });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...charcoal);
  doc.text(`${COMPANY.phoneOne} | ${COMPANY.phoneTwo}`, pageW - margin, sigY + 16, {
    align: "right"
  });

  if (data.beforePhotoData || data.afterPhotoData) {
    doc.addPage();

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, pageH, "F");

    doc.setFillColor(...black);
    doc.rect(0, 0, pageW, 18, "F");

    doc.setFillColor(...gold);
    doc.rect(0, 18, pageW, 2.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...black);
    doc.text("Before / After Photos", margin, 36);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...charcoal);
    doc.text(`INV-${data.invoiceNumber} — ${data.customerName}`, margin, 43);

    const boxY = 58;
    const boxW = (pageW - margin * 2 - 8) / 2;
    const boxH = 145;

    doc.setDrawColor(...line);
    doc.setFillColor(...soft);
    doc.roundedRect(margin, boxY, boxW, boxH, 4, 4, "FD");
    doc.roundedRect(margin + boxW + 8, boxY, boxW, boxH, 4, 4, "FD");

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...gold);
    doc.text("BEFORE", margin + 5, boxY + 9);
    doc.text("AFTER", margin + boxW + 13, boxY + 9);

    addImageContain(doc, data.beforePhotoData, margin + 5, boxY + 15, boxW - 10, boxH - 22);
    addImageContain(doc, data.afterPhotoData, margin + boxW + 13, boxY + 15, boxW - 10, boxH - 22);
  }

  const safeCustomerName = (data.customerName || "Customer").replace(/[^a-z0-9]+/gi, "-");
  const fileName = `TC-Residential-Invoice-${data.invoiceNumber}-${safeCustomerName}.pdf`;

  doc.save(fileName);
}

function init() {
  els.invoiceDate.value = todayIso();

  setInvoiceBadge(getNextInvoiceNumber());

  addServiceRow();
  initSignaturePad();
  renderSavedInvoices();
  updateTotals();

  els.addServiceBtn.addEventListener("click", () => addServiceRow());

  els.paymentStatus.addEventListener("change", updateTotals);
  els.amountPaid.addEventListener("input", updateTotals);

  els.beforePhoto.addEventListener("change", () => {
    handlePhotoInput(els.beforePhoto, els.beforePreview, "before");
  });

  els.afterPhoto.addEventListener("change", () => {
    handlePhotoInput(els.afterPhoto, els.afterPreview, "after");
  });

  els.clearBeforePhoto.addEventListener("click", () => clearPhoto("before"));
  els.clearAfterPhoto.addEventListener("click", () => clearPhoto("after"));

  els.clearSignatureBtn.addEventListener("click", clearSignature);

  els.saveInvoiceBtn.addEventListener("click", () => {
    const saved = saveInvoice();

    if (saved) {
      alert(`Saved INV-${saved.invoiceNumber} on this device.`);
    }
  });

  els.generatePdfBtn.addEventListener("click", () => generatePdf());

  els.resetFormBtn.addEventListener("click", resetForm);
}

init();