// ===== KONFIGURASI =====
const SPREADSHEET_ID = "1FRlb80L324rGvVmfOkYVL2MNGurpz4UUSCtmhn19h_g";
const SHEET_NAME     = "Sheet10";
const API_URL        = `https://opensheet.elk.sh/${SPREADSHEET_ID}/${encodeURIComponent(SHEET_NAME)}`;
const PER_PAGE       = 30;

// ===== STATE =====
let allBooks    = [];
let filtered    = [];
let currentPage = 1;
let activeCat   = "all";
let searchQuery = "";
let sortMode    = "default";
let CONFIG      = {};

// ===== ELEMEN =====
const grid        = document.getElementById("bookGrid");
const loadingEl   = document.getElementById("loading");
const errorEl     = document.getElementById("errorMsg");
const searchInput = document.getElementById("searchInput");
const sortSelect  = document.getElementById("sortSelect");
const catScroll   = document.getElementById("categoryScroll");
const resultCount = document.getElementById("resultCount");
const pageInfo    = document.getElementById("pageInfo");
const pagination  = document.getElementById("pagination");

// ===== UTILS =====
function formatRupiah(val) {
  const n = parseInt(String(val).replace(/[^0-9]/g, ""), 10);
  if (isNaN(n)) return val || "—";
  return "Rp\u00A0" + n.toLocaleString("id-ID");
}

function parseRupiah(val) {
  return parseInt(String(val || "0").replace(/[^0-9]/g, ""), 10) || 0;
}

// function parseDiskon(val) {
//   return parseInt(String(val || "0").replace(/[^0-9]/g, ""), 10) || 0;
// }

function parseDiskon(val) {
  // Ganti koma desimal dengan titik, lalu ambil angka depannya saja
  const cleaned = String(val || "0").replace(",", ".");
  return Math.round(parseFloat(cleaned)) || 0;
}

function statusClass(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (s === "TERSEDIA") return "tersedia";
  if (s === "PRE ORDER" || s === "PREORDER") return "pre-order";
  return "habis";
}

function statusLabel(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (s === "TERSEDIA")  return "Tersedia";
  if (s === "PRE ORDER" || s === "PREORDER") return "Pre Order";
  if (s === "HABIS")     return "Habis";
  return raw || "—";
}

// ===== SORT =====
function sortBooks(books) {
  const arr = [...books];
  const priceCol = CONFIG.priceCol || "Harga jual";
  // const discCol  = CONFIG.discountCol || "Diskon jual";

  switch (sortMode) {
    case "title-az":
      return arr.sort((a, b) =>
        String(a["Nama Produk"] || "").localeCompare(String(b["Nama Produk"] || ""), "id"));
    case "title-za":
      return arr.sort((a, b) =>
        String(b["Nama Produk"] || "").localeCompare(String(a["Nama Produk"] || ""), "id"));
    case "price-asc":
      return arr.sort((a, b) => parseRupiah(a[priceCol]) - parseRupiah(b[priceCol]));
    case "price-desc":
      return arr.sort((a, b) => parseRupiah(b[priceCol]) - parseRupiah(a[priceCol]));
    default:
      return arr;
  }
}

// ===== KATEGORI =====
function buildCategories(books) {
  const set = new Set();
  books.forEach(b => {
    ["Kategori 1", "Kategori 2", "Kategori 3"].forEach(k => {
      const v = String(b[k] || "").trim();
      if (v) set.add(v);
    });
  });

  catScroll.querySelectorAll(".cat-chip:not([data-cat='all'])").forEach(c => c.remove());

  [...set].sort((a, b) => a.localeCompare(b, "id")).forEach(cat => {
    const btn = document.createElement("button");
    btn.className   = "cat-chip";
    btn.dataset.cat = cat;
    btn.textContent = cat;
    btn.addEventListener("click", () => onCatClick(btn, cat));
    catScroll.appendChild(btn);
  });
}

function onCatClick(btn, cat) {
  activeCat = cat;
  catScroll.querySelectorAll(".cat-chip").forEach(c => c.classList.remove("active"));
  btn.classList.add("active");
  currentPage = 1;
  applyFilters();
}

// ===== FILTER + SORT + PAGINATE =====
function applyFilters() {
  const q = searchQuery.toLowerCase().trim();

  let result = allBooks.filter(b => {
    const matchSearch = !q
      || String(b["Nama Produk"] || "").toLowerCase().includes(q)
      || String(b["Penerbit"]    || "").toLowerCase().includes(q);

    const matchCat = activeCat === "all"
      || ["Kategori 1", "Kategori 2", "Kategori 3"]
          .some(k => String(b[k] || "").trim() === activeCat);

    return matchSearch && matchCat;
  });

  result = sortBooks(result);
  filtered = result;

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (currentPage > pages) currentPage = 1;

  const start = (currentPage - 1) * PER_PAGE;
  const slice = filtered.slice(start, start + PER_PAGE);

  const end = Math.min(start + PER_PAGE, total);
  resultCount.textContent = total
    ? `Menampilkan ${start + 1}–${end} dari ${total} judul`
    : "Tidak ada judul ditemukan";
  pageInfo.textContent = pages > 1 ? `Halaman ${currentPage} / ${pages}` : "";

  renderCards(slice);
  renderPagination(pages);
}

// ===== RENDER CARDS =====
function renderCards(books) {
  if (!books.length) {
    grid.innerHTML = `<div class="state-empty">Tidak ada buku yang cocok dengan pencarianmu.</div>`;
    return;
  }

  const priceCol = CONFIG.priceCol     || "Harga jual";
  const discCol  = CONFIG.discountCol  || "Diskon jual";
  const baseCol  = CONFIG.basePriceCol || "Harga katalog";

  grid.innerHTML = books.map(b => {
    const judul     = b["Nama Produk"]  || "Tanpa Judul";
    const penerbit  = b["Penerbit"]     || "";
    const cover     = b["Cover"]        || "";
    const berat     = b["Berat"]        ? `${b["Berat"]} g` : "";
    const sampul    = b["Sampul"]       || "";
    const linkProd  = b["Lihat Produk"] || "";
    const status    = b["Status"]       || "";
    const hargaBase = b[baseCol]        || "";
    const diskon    = b[discCol]        || "";
    const hargaJual = b[priceCol]       || "";

    const coverHtml = cover
      ? `<img src="${cover}" alt="${judul}" loading="lazy"
             onerror="this.style.display='none'">`
      : "📖";

    const strikeHtml = hargaBase && hargaJual && hargaBase !== hargaJual
      ? `<span class="price-strike">${formatRupiah(hargaBase)}</span>` : "";

    const discNum = parseDiskon(diskon);
    const discHtml = discNum > 0
      ? `<span class="price-discount">−${discNum}%</span>` : "";

    const priceHtml = `<span class="price-final">${formatRupiah(hargaJual || hargaBase)}</span>`;

    const stClass = statusClass(status);
    const stLabel = statusLabel(status);

    const metaParts = [
      penerbit ? `<span class="book-publisher">${penerbit}</span>` : "",
      sampul   ? `<span class="book-sampul">${sampul}</span>` : "",
      berat    ? `<span class="book-weight">${berat}</span>` : "",
    ].filter(Boolean).join("");

    const linkHtml = linkProd
      ? `<a href="${linkProd}" target="_blank" rel="noopener" class="detail-btn">
           <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
             <path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3M10 2h4m0 0v4m0-4L7 9"
               stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>
           Detail
         </a>` : "";

    return `
      <div class="book-card">
        <div class="book-cover">${coverHtml}</div>
        <div class="book-body">
          <div class="book-title">${judul}</div>
          ${metaParts ? `<div class="book-meta">${metaParts}</div>` : ""}
          <div class="book-price-row">${strikeHtml}${discHtml}${priceHtml}</div>
          <div class="book-footer">
            <span class="status-badge ${stClass}">${stLabel}</span>
            ${linkHtml}
          </div>
        </div>
      </div>`;
  }).join("");
}

// ===== PAGINATION =====
function renderPagination(pages) {
  if (pages <= 1) { pagination.innerHTML = ""; return; }

  const range = buildRange(currentPage, pages);
  let html = `<button class="pg-btn" onclick="goPage(${currentPage - 1})"
    ${currentPage === 1 ? "disabled" : ""}>&#8249; Prev</button>`;

  range.forEach(p => {
    if (p === "…") {
      html += `<span class="pg-dots">…</span>`;
    } else {
      html += `<button class="pg-btn ${p === currentPage ? "active" : ""}"
        onclick="goPage(${p})">${p}</button>`;
    }
  });

  html += `<button class="pg-btn" onclick="goPage(${currentPage + 1})"
    ${currentPage === pages ? "disabled" : ""}>Next &#8250;</button>`;
  pagination.innerHTML = html;
}

function buildRange(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (cur <= 4)           return [1, 2, 3, 4, 5, "…", total];
  if (cur >= total - 3)   return [1, "…", total-4, total-3, total-2, total-1, total];
  return [1, "…", cur - 1, cur, cur + 1, "…", total];
}

function goPage(n) {
  const pages = Math.ceil(filtered.length / PER_PAGE);
  if (n < 1 || n > pages) return;
  currentPage = n;
  applyFilters();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ===== FETCH =====
async function fetchBooks() {
  try {
    loadingEl.style.display = "block";
    errorEl.style.display   = "none";
    grid.innerHTML          = "";
    pagination.innerHTML    = "";

    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Status HTTP " + res.status);

    allBooks = await res.json();
    loadingEl.style.display = "none";

    buildCategories(allBooks);
    applyFilters();
  } catch (err) {
    loadingEl.style.display = "none";
    errorEl.style.display   = "block";
    errorEl.textContent = "Katalog tidak dapat dimuat: " + err.message
      + ". Pastikan spreadsheet sudah dipublish dan akses dibuka.";
  }
}

// ===== INIT =====
function initCatalog(config) {
  CONFIG = config || {};

  // Search
  searchInput.addEventListener("input", e => {
    searchQuery = e.target.value;
    currentPage = 1;
    applyFilters();
  });

  // Sort
  if (sortSelect) {
    sortSelect.addEventListener("change", e => {
      sortMode = e.target.value;
      currentPage = 1;
      applyFilters();
    });
  }

  // Chip "Semua"
  document.querySelector(".cat-chip[data-cat='all']")
    .addEventListener("click", function () { onCatClick(this, "all"); });

  fetchBooks();
  setInterval(fetchBooks, 5 * 60 * 1000);
}