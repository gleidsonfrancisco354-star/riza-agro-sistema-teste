const state = { user: null, products: [], proposals: [], users: [], clients: [], permissions: [], activityLogs: [], attachments: [], editingProposalId: null };
const $ = (id) => document.getElementById(id);
const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const brl = (value) => round2(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const html = (value = "") => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));

const commissionPolicies = {
  revenda: {
    label: "Revenda",
    subtitle: "Desconto automatico de 10%",
    maxDiscount: 10,
    autoItemDiscount: 10,
    rows: [
      ["Coordenador Regional", 2.50, false],
      ["RTV", 3.00, false],
      ["Gerente Nacional de Vendas", 1.00, false],
      ["Retaguarda Comercial", 0.10, false],
      ["Gerente de Planejamento", 0.25, false],
      ["Diretor Comercial", 0.33, false]
    ]
  },
  venda_direta: {
    label: "Venda Direta",
    subtitle: "Desconto maximo de 15%",
    maxDiscount: 15,
    autoItemDiscount: 0,
    rows: [
      ["Coordenador Regional", 1.00, false],
      ["Gerente Nacional de Vendas", 1.00, false],
      ["Retaguarda Comercial", 0.10, false],
      ["Gerente de Planejamento", 0.25, false],
      ["Diretor Comercial", 0.33, false]
    ]
  },
  cliente_final: {
    label: "Cliente Final",
    subtitle: "Desconto maximo de 10%",
    maxDiscount: 10,
    autoItemDiscount: 0,
    rows: [
      ["Representante Comercial", 10.00, true, 1.00],
      ["Coordenador Regional", 2.50, true, 1.50],
      ["Gerente Nacional de Vendas", 1.00, false],
      ["Retaguarda Comercial", 0.10, false],
      ["Gerente de Planejamento", 0.25, false],
      ["Diretor Comercial", 0.33, false]
    ]
  }
};

const modules = [
  ["dashboard", "DASHBOARD", "dashboard"],
  ["proposal", "PROPOSTA COMERCIAL", "proposal"],
  ["rizaPlus", "RIZA+", "plus"],
  ["virtus", "RIZA VIRTUS", "leaf"],
  ["finance", "SIMULADOR FINANCEIRO", "finance"],
  ["clients", "CLIENTES", "clients"],
  ["products", "PRODUTOS", "products"],
  ["history", "HISTORICO", "history"],
  ["reports", "RELATORIOS", "reports"],
  ["commissions", "COMISSIONAMENTO", "commission"],
  ["users", "CONFIGURACOES", "settings"]
];

const userProfiles = [
  "Representante Comercial",
  "Coordenador Regional",
  "RTV",
  "Diretor Comercial",
  "Retaguarda Comercial",
  "Gerente de Planejamento"
];

const permissionLabels = {
  dashboard: "Dashboard",
  proposal: "Proposta comercial",
  rizaPlus: "Tabela Riza+",
  virtus: "Tabela Riza Virtus",
  finance: "Simulador financeiro",
  clients: "Clientes",
  products: "Produtos",
  history: "Historico",
  reports: "Relatorios",
  commissions: "Comissionamento da equipe",
  users: "Usuarios e permissoes",
  viewAll: "Ver tudo da equipe",
  viewMargin: "Ver margem",
  viewCommissionPolicy: "Ver politica de comissao",
  viewDirectorSummary: "Ver resumo diretoria",
  deleteProposals: "Excluir propostas",
  discountOverride: "Liberar desconto acima da regra"
};

const profilePermissions = {
  "Representante Comercial": ["dashboard", "proposal", "rizaPlus", "virtus", "clients", "history"],
  "RTV": ["dashboard", "proposal", "rizaPlus", "virtus", "clients", "history"],
  "Coordenador Regional": ["dashboard", "proposal", "rizaPlus", "virtus", "clients", "history", "reports", "commissions", "viewAll"],
  "Gerente de Planejamento": ["dashboard", "proposal", "rizaPlus", "virtus", "clients", "products", "history", "reports", "commissions", "viewAll", "viewMargin"],
  "Retaguarda Comercial": ["dashboard", "proposal", "rizaPlus", "virtus", "clients", "products", "history", "reports", "commissions", "viewAll", "viewCommissionPolicy"],
  "Diretor Comercial": ["dashboard", "proposal", "rizaPlus", "virtus", "finance", "clients", "products", "history", "reports", "commissions", "users", "viewAll", "viewMargin", "viewCommissionPolicy", "viewDirectorSummary", "deleteProposals", "discountOverride"]
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(data.error || data || "Erro na operacao.");
  return data;
}

function can(id) {
  return state.user?.permissions?.includes(id);
}

function productName(product) {
  return `${cleanText(product.linha)} | ${cleanText(product.produto)} | ${cleanText(product.tecnologia)}`;
}

function uniqueValues(items, field) {
  return [...new Set(items.map((item) => item[field]).filter(Boolean))];
}

function cleanText(value) {
  let text = String(value || "");
  try {
    text = decodeURIComponent(escape(text));
  } catch {}
  return text
    .replace(/Ãƒâ€¡/g, "Ã‡")
    .replace(/ÃƒÂ/g, "Ã")
    .replace(/Ãƒâ€°/g, "Ã‰")
    .replace(/ÃƒÆ’/g, "Ãƒ")
    .replace(/ÃƒÂ£/g, "Ã£")
    .replace(/ÃƒÂ¡/g, "Ã¡")
    .replace(/ÃƒÂ©/g, "Ã©")
    .replace(/ÃƒÂ­/g, "Ã­")
    .replace(/ÃƒÂ³/g, "Ã³")
    .replace(/ÃƒÂº/g, "Ãº")
    .replace(/Ã‚Âª/g, "Âª")
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢|Ã¢â‚¬Â¢|â€¢/g, "-")
    .replace(/ï¿½/g, "")
    .replace(/\s+-\s+/g, " - ");
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function maskCpfCnpj(value) {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskCep(value) {
  return onlyDigits(value).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

function maskPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function findProduct(line, cultivar, standard) {
  return state.products.find((item) => item.linha === line && item.produto === cultivar && String(item.tecnologia) === String(standard))
    || state.products.find((item) => item.linha === line && item.produto === cultivar)
    || state.products.find((item) => item.linha === line)
    || state.products[0];
}

function prazoIndexFromMonths(months) {
  return Math.min(Math.max(0, Math.floor(Number(months || 0))), 6);
}

function dateFromInput(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function commercialMonthsBetween(startValue, endValue) {
  const start = dateFromInput(startValue);
  const end = dateFromInput(endValue);
  if (!start || !end || end < start) return 0;
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
}

function paymentHorizonMonths() {
  const startDate = $("proposalDate")?.value || new Date().toISOString().slice(0, 10);
  const installmentDates = [...document.querySelectorAll(".installmentDateInput")]
    .map((input) => input.value)
    .filter(Boolean);
  if (installmentDates.length) {
    return Math.max(...installmentDates.map((date) => commercialMonthsBetween(startDate, date)));
  }
  return Math.max(0, Math.floor(Number($("financeInstallments")?.value || 0)));
}

function priceForMonths(product, months) {
  const cleanMonths = Math.max(0, Math.floor(Number(months || 0)));
  const monthlyInterest = Number($("financeInterest")?.value || 2) / 100;
  return round2(Number(product?.preco || 0) * Math.pow(1 + monthlyInterest, cleanMonths));
}

function paymentHorizonDays() {
  return paymentHorizonMonths() * 30;
}

function getCommissionPolicy() {
  return commissionPolicies[$("saleModel")?.value] || commissionPolicies.revenda;
}

function integerDiscount(value) {
  const number = Math.round(Number(value || 0));
  return Math.max(0, Number.isFinite(number) ? number : 0);
}

function discountLimitForCurrentUser(policy) {
  const saleModel = $("saleModel")?.value || "revenda";
  if (saleModel === "revenda") return 10;
  return can("discountOverride") ? 30 : Number(policy.maxDiscount || 0);
}

function applySaleModelRules() {
  const policy = getCommissionPolicy();
  const saleModel = $("saleModel")?.value || "revenda";
  const maxDiscount = discountLimitForCurrentUser(policy);
  const autoDiscount = saleModel === "revenda" ? 10 : 0;
  if ($("discountPct")) {
    $("discountPct").min = "0";
    $("discountPct").max = String(maxDiscount);
    $("discountPct").step = "1";
    if (autoDiscount > 0) {
      $("discountPct").value = "0";
      $("discountPct").disabled = true;
      $("discountPct").title = "Revenda aplica 10% de desconto direto nos itens.";
    } else {
      $("discountPct").disabled = false;
      const current = integerDiscount($("discountPct").value);
      $("discountPct").value = String(Math.min(current, maxDiscount));
      $("discountPct").title = `Desconto maximo deste canal: ${maxDiscount}%`;
    }
  }
  $("itemsBody")?.querySelectorAll(".itemDiscountInput").forEach((input) => {
    input.min = "0";
    input.max = String(maxDiscount);
    input.step = "1";
    if (autoDiscount > 0) {
      input.value = String(autoDiscount);
      input.readOnly = true;
      input.dataset.autoDiscount = "true";
      input.title = "Revenda aplica desconto automatico de 10%.";
    } else {
      if (input.dataset.autoDiscount === "true") input.value = "0";
      delete input.dataset.autoDiscount;
      input.readOnly = false;
      input.title = `Desconto maximo deste canal: ${maxDiscount}%`;
      input.value = String(Math.min(integerDiscount(input.value), maxDiscount));
    }
  });
}

function renderSensitiveUi() {
  const visibility = [
    ["marginPct", can("viewMargin")],
    ["commissionBase", can("viewCommissionPolicy")],
    ["commissionFinal", can("viewCommissionPolicy")]
  ];
  visibility.forEach(([id, visible]) => {
    const input = $(id);
    if (input?.closest("label")) input.closest("label").classList.toggle("hidden", !visible);
  });
  document.querySelectorAll(".commissionBox").forEach((item) => item.classList.toggle("hidden", !can("viewCommissionPolicy")));
  document.querySelectorAll(".summaryPanel").forEach((item) => item.classList.toggle("hidden", !can("viewDirectorSummary")));
  if ($("directorSummary")) $("directorSummary").classList.toggle("hidden", !can("viewDirectorSummary"));
}

function updateItemPricesForPayment() {
  const months = paymentHorizonMonths();
  $("itemsBody")?.querySelectorAll("tr").forEach((tr) => {
    const selected = state.products[Number(tr.dataset.productIndex)] || findProduct(
      tr.querySelector(".lineSelect").value,
      tr.querySelector(".cultivarSelect").value,
      tr.querySelector(".standardSelect").value
    );
    tr.querySelector(".priceInput").value = priceForMonths(selected, months).toFixed(2);
  });
}

function showFileModeMessage() {
  $("fileModeHelp").classList.remove("hidden");
  $("loginError").textContent = "Abra pelo ABRIR_SISTEMA_RIZA.bat ou pelo endereco http://localhost:8787/";
}

function buildNav() {
  $("navList").innerHTML = modules.filter(([id]) => can(id)).map(([id, label, icon]) => (
    `<button class="navBtn ${id === "dashboard" ? "active" : ""}" data-page="${id}"><span class="navIcon icon-${icon}"></span>${label}</button>`
  )).join("");
  document.querySelectorAll(".navBtn").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.page)));
}

function showPage(id) {
  if (!can(id)) return;
  document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === id));
  document.querySelectorAll(".navBtn").forEach((button) => button.classList.toggle("active", button.dataset.page === id));
  if (id === "proposal") $("pageTitle").textContent = "SIMULADOR DE PROPOSTA COMERCIAL";
  else if (id === "dashboard") $("pageTitle").textContent = "DASHBOARD DIRETORIA COMERCIAL";
  else $("pageTitle").textContent = (modules.find((item) => item[0] === id) || ["", "DASHBOARD"])[1];
}

function renderStats(nextCode) {
  if ($("nextCode")) $("nextCode").textContent = nextCode || $("nextCode").textContent;
  renderDashboard();
  calculateTotals();
}

function renderDashboard() {
  const total = state.proposals.reduce((sum, proposal) => sum + Number(proposal.total || 0), 0);
  const clients = new Map();
  state.proposals.forEach((proposal) => {
    if (proposal.customer?.name) clients.set(proposal.customer.name, proposal.customer);
  });
  if ($("dashProposals")) $("dashProposals").textContent = state.proposals.length;
  if ($("dashRevenue")) $("dashRevenue").textContent = brl(total);
  if ($("dashClients")) $("dashClients").textContent = clients.size;
  if ($("dashTicket")) $("dashTicket").textContent = brl(state.proposals.length ? total / state.proposals.length : 0);
  if ($("dashboardLatest")) {
    $("dashboardLatest").innerHTML = state.proposals.slice(0, 6).map((proposal) => (
      `<div class="dashLine"><b>${proposal.code}</b><span>${proposal.customer.name}</span><strong>${brl(proposal.total)}</strong></div>`
    )).join("") || "<div class='emptyState compact'>Nenhuma proposta gerada ainda.</div>";
  }
  if ($("dashboardClients")) {
    $("dashboardClients").innerHTML = [...clients.values()].slice(0, 6).map((client) => (
      `<div class="dashLine"><b>${client.name}</b><span>${client.company || "Sem fazenda"}</span><strong>${client.city || ""}</strong></div>`
    )).join("") || "<div class='emptyState compact'>Clientes aparecem aqui apos salvar propostas.</div>";
  }
}

function isOrder(proposal) {
  return String(proposal?.status || "").toLowerCase() === "pedido" || !!proposal?.orderCreatedAt;
}

function orderProposals() {
  return state.proposals.filter(isOrder);
}

function renderProducts() {
  $("productsBody").innerHTML = state.products.map((product) => `
    <tr><td>${cleanText(product.linha)}</td><td><b>${cleanText(product.produto)}</b></td><td>${cleanText(product.tecnologia)}</td><td>${cleanText(product.apresentacao)}</td><td class="moneyCell">${brl(product.preco)}</td></tr>`
  ).join("");
  renderProductCards("rizaPlusGrid", state.products.filter((product) => product.linha === "RIZA+"));
  renderProductCards("virtusGrid", state.products.filter((product) => product.linha === "RIZA VIRTUS"));
  renderMiniProducts("rizaPlusMini", state.products.filter((product) => product.linha === "RIZA+").slice(0, 5));
  renderMiniProducts("virtusMini", state.products.filter((product) => product.linha === "RIZA VIRTUS").slice(0, 5));
}

function renderProductCards(target, products) {
  if (!$(target)) return;
  $(target).innerHTML = products.map((product) => {
    const index = state.products.indexOf(product);
    return `
    <div class="productCard">
      <small>${cleanText(product.linha)}</small>
      <b>${cleanText(product.produto)}</b>
      <span>${cleanText(product.tecnologia)} - ${cleanText(product.apresentacao)}</span>
      <strong>${brl(product.preco)}</strong>
      <button class="productAddBtn" data-add-product="${index}">Incluir na proposta</button>
    </div>`;
  }
  ).join("");
  $(target).querySelectorAll("[data-add-product]").forEach((button) => button.addEventListener("click", () => {
    addItem(state.products[Number(button.dataset.addProduct)]);
    showPage("proposal");
  }));
}

function renderMiniProducts(target, products) {
  if (!$(target)) return;
  $(target).innerHTML = products.map((product) => {
    const index = state.products.indexOf(product);
    const packageText = cleanText(product.apresentacao).replace(/^Saco\s+/i, "");
    return `<tr><td><b>${cleanText(product.produto)}</b></td><td>${cleanText(product.tecnologia)}</td><td>${packageText}</td><td class="moneyCell">${brl(product.preco)}</td><td><button class="addMiniBtn" data-add-product="${index}">+</button></td></tr>`;
  }).join("");
  $(target).querySelectorAll("[data-add-product]").forEach((button) => button.addEventListener("click", () => addItem(state.products[Number(button.dataset.addProduct)])));
}

function updateRowDisplay(tr, product) {
  const selected = product || state.products[Number(tr.dataset.productIndex)] || {};
  const packageText = tr.querySelector(".packageInput")?.value || selected.apresentacao || "";
  const price = Number(tr.querySelector(".priceInput")?.value || selected.preco || 0);
  if (tr.querySelector(".itemProductName")) tr.querySelector(".itemProductName").textContent = cleanText(selected.produto || tr.querySelector(".cultivarSelect")?.value || "");
  if (tr.querySelector(".itemLineName")) tr.querySelector(".itemLineName").textContent = cleanText(selected.linha || tr.querySelector(".lineSelect")?.value || "");
  if (tr.querySelector(".standardText")) tr.querySelector(".standardText").textContent = cleanText(selected.tecnologia || tr.querySelector(".standardSelect")?.value || "");
  if (tr.querySelector(".packageText")) tr.querySelector(".packageText").textContent = cleanText(packageText);
  if (tr.querySelector(".priceText")) tr.querySelector(".priceText").textContent = brl(price);
}

function addItem(product = state.products[0]) {
  if (!product) return;
  const tr = document.createElement("tr");
  const lineOptions = uniqueValues(state.products, "linha").map((line) => `<option value="${line}">${cleanText(line)}</option>`).join("");
  tr.innerHTML = `
    <td class="cultivarCell"><b class="itemProductName"></b><span class="itemLineName"></span><select class="cultivarSelect rowHidden"></select><select class="lineSelect rowHidden">${lineOptions}</select></td>
    <td><span class="standardText"></span><select class="standardSelect rowHidden"></select></td>
    <td><span class="packageText"></span><input class="packageInput rowHidden" value="${product.apresentacao || ""}"></td>
    <td><input class="quantityInput" type="number" min="0" step="1" value="1"></td>
    <td class="unitCell">kg</td>
    <td class="priceCell"><span class="priceText">${brl(product.preco || 0)}</span><input class="priceInput rowHidden" type="number" min="0" step="0.01" value="${product.preco || 0}"></td>
    <td><input class="itemDiscountInput" type="number" min="0" max="10" step="1" value="0"></td>
    <td class="discountedUnitCell">R$ 0,00</td>
    <td class="totalCell">R$ 0,00</td>
    <td><button type="button" class="removeBtn">x</button></td>`;
  const lineSelect = tr.querySelector(".lineSelect");
  const cultivarSelect = tr.querySelector(".cultivarSelect");
  const standardSelect = tr.querySelector(".standardSelect");

  function fillCultivars(preferredCultivar) {
    const cultivars = uniqueValues(state.products.filter((item) => item.linha === lineSelect.value), "produto");
    cultivarSelect.innerHTML = cultivars.map((cultivar) => `<option value="${cultivar}">${cleanText(cultivar)}</option>`).join("");
    if (preferredCultivar && cultivars.includes(preferredCultivar)) cultivarSelect.value = preferredCultivar;
  }

  function fillStandards(preferredStandard) {
    const standards = uniqueValues(state.products.filter((item) => item.linha === lineSelect.value && item.produto === cultivarSelect.value), "tecnologia");
    standardSelect.innerHTML = standards.map((standard) => `<option value="${standard}">${cleanText(standard)}</option>`).join("");
    if (preferredStandard && standards.map(String).includes(String(preferredStandard))) standardSelect.value = preferredStandard;
  }

  function syncProduct() {
    const selected = findProduct(lineSelect.value, cultivarSelect.value, standardSelect.value);
    tr.dataset.productIndex = String(state.products.indexOf(selected));
    tr.querySelector(".packageInput").value = selected.apresentacao || "";
    tr.querySelector(".priceInput").value = priceForMonths(selected, paymentHorizonMonths()).toFixed(2);
    updateRowDisplay(tr, selected);
    calculateTotals();
  }

  lineSelect.value = product.linha;
  fillCultivars(product.produto);
  fillStandards(product.tecnologia);
  syncProduct();
  lineSelect.addEventListener("change", () => {
    fillCultivars();
    fillStandards();
    syncProduct();
  });
  cultivarSelect.addEventListener("change", () => {
    fillStandards();
    syncProduct();
  });
  standardSelect.addEventListener("change", syncProduct);
  tr.querySelectorAll("input").forEach((input) => input.addEventListener("input", calculateTotals));
  tr.querySelector(".removeBtn").addEventListener("click", () => { tr.remove(); calculateTotals(); });
  $("itemsBody").appendChild(tr);
  applySaleModelRules();
  calculateTotals();
}

function readItems() {
  return [...$("itemsBody").querySelectorAll("tr")].map((tr) => {
    const selected = state.products[Number(tr.dataset.productIndex)] || findProduct(
      tr.querySelector(".lineSelect").value,
      tr.querySelector(".cultivarSelect").value,
      tr.querySelector(".standardSelect").value
    );
    const quantity = Number(tr.querySelector(".quantityInput").value || 0);
    const unitPrice = Number(tr.querySelector(".priceInput").value || 0);
    const cashUnitPrice = Number(selected.preco || unitPrice);
    const discountPct = integerDiscount(tr.querySelector(".itemDiscountInput")?.value || 0);
    const discountedUnitPrice = round2(Math.max(0, unitPrice - unitPrice * discountPct / 100));
    const grossTotal = quantity * unitPrice;
    const grossCashTotal = quantity * cashUnitPrice;
    return {
      line: selected.linha,
      product: selected.produto,
      standard: tr.querySelector(".standardSelect").value,
      package: tr.querySelector(".packageInput").value,
      quantity,
      unitPrice,
      discountedUnitPrice,
      cashUnitPrice,
      discountPct,
      grossTotal,
      grossCashTotal,
      total: Math.max(0, grossTotal - grossTotal * discountPct / 100),
      cashTotal: Math.max(0, grossCashTotal - grossCashTotal * discountPct / 100)
    };
  });
}

function currentProposalTotal() {
  return [...$("itemsBody").querySelectorAll("tr")].reduce((sum, tr) => (
    sum + Number(tr.querySelector(".totalCell")?.dataset.total || 0)
  ), 0);
}

function calculateTotals() {
  applySaleModelRules();
  updateItemPricesForPayment();
  let grossTotal = 0;
  let cashGrossTotal = 0;
  let itemDiscountTotal = 0;
  let cashItemDiscountTotal = 0;
  let itemCount = 0;
  $("itemsBody").querySelectorAll("tr").forEach((tr) => {
    const selected = state.products[Number(tr.dataset.productIndex)] || {};
    const qty = Number(tr.querySelector(".quantityInput").value || 0);
    const unitPrice = Number(tr.querySelector(".priceInput").value || 0);
    const cashUnitPrice = Number(selected.preco || unitPrice);
    const itemDiscountPct = integerDiscount(tr.querySelector(".itemDiscountInput")?.value || 0);
    const grossLine = round2(qty * unitPrice);
    const cashGrossLine = round2(qty * cashUnitPrice);
    const itemDiscount = round2(grossLine * itemDiscountPct / 100);
    const cashItemDiscount = round2(cashGrossLine * itemDiscountPct / 100);
    const line = round2(Math.max(0, grossLine - itemDiscount));
    const discountedUnit = round2(Math.max(0, unitPrice - unitPrice * itemDiscountPct / 100));
    updateRowDisplay(tr, selected);
    if (tr.querySelector(".discountedUnitCell")) tr.querySelector(".discountedUnitCell").textContent = brl(discountedUnit);
    tr.querySelector(".totalCell").textContent = brl(line);
    tr.querySelector(".totalCell").dataset.total = String(line);
    itemCount += qty;
    grossTotal += grossLine;
    cashGrossTotal += cashGrossLine;
    itemDiscountTotal += itemDiscount;
    cashItemDiscountTotal += cashItemDiscount;
  });
  const policy = getCommissionPolicy();
  const maxDiscount = discountLimitForCurrentUser(policy);
  const discountPct = Math.min(integerDiscount($("discountPct")?.value || 0), maxDiscount);
  const freight = $("freightEnabled")?.checked ? round2(Math.max(0, Number($("freightValue")?.value || 0))) : 0;
  grossTotal = round2(grossTotal);
  cashGrossTotal = round2(cashGrossTotal);
  itemDiscountTotal = round2(itemDiscountTotal);
  cashItemDiscountTotal = round2(cashItemDiscountTotal);
  const afterItemDiscount = round2(Math.max(0, grossTotal - itemDiscountTotal));
  const cashAfterItemDiscount = round2(Math.max(0, cashGrossTotal - cashItemDiscountTotal));
  const maxDiscountValue = round2(grossTotal * maxDiscount / 100);
  const maxCashDiscountValue = round2(cashGrossTotal * maxDiscount / 100);
  const availableGlobalDiscount = Math.max(0, maxDiscountValue - itemDiscountTotal);
  const availableCashGlobalDiscount = Math.max(0, maxCashDiscountValue - cashItemDiscountTotal);
  const globalDiscountValue = round2(Math.min(afterItemDiscount * discountPct / 100, availableGlobalDiscount));
  const cashGlobalDiscountValue = round2(Math.min(cashAfterItemDiscount * discountPct / 100, availableCashGlobalDiscount));
  const discountValue = round2(itemDiscountTotal + globalDiscountValue);
  const cashDiscountValue = round2(cashItemDiscountTotal + cashGlobalDiscountValue);
  const finalTotalNoFreight = round2(Math.max(0, grossTotal - discountValue));
  const cashFinalTotalNoFreight = round2(Math.max(0, cashGrossTotal - cashDiscountValue));
  const finalTotal = round2(finalTotalNoFreight + freight);
  const cashFinalTotal = round2(cashFinalTotalNoFreight + freight);
  const totalDiscountPct = grossTotal > 0 ? discountValue / grossTotal * 100 : 0;
  const commissionInfo = getCommissionTotals(totalDiscountPct);
  const commissionPct = commissionInfo.finalPct / 100;
  const commission = round2(finalTotalNoFreight * commissionPct);
  state.currentTotals = { grossTotal, cashGrossTotal, discountValue, cashDiscountValue, finalTotal, finalTotalNoFreight, cashFinalTotal, cashFinalTotalNoFreight, freight, totalDiscountPct, horizonDays: paymentHorizonDays(), horizonMonths: paymentHorizonMonths() };
  const pairs = [["proposalTotal", finalTotal], ["kpiGross", round2(cashGrossTotal + freight)], ["kpiDiscount", discountValue], ["kpiFinal", finalTotal], ["kpiCommission", commission], ["financeGross", round2(cashGrossTotal + freight)], ["financeDiscount", discountValue], ["financeFinal", finalTotal]];
  pairs.forEach(([id, value]) => { if ($(id)) $(id).textContent = brl(value); });
  if ($("kpiItems")) $("kpiItems").textContent = `${itemCount} itens`;
  if ($("kpiFinalItems")) $("kpiFinalItems").textContent = `${itemCount} itens`;
  if ($("kpiDiscountPct")) $("kpiDiscountPct").textContent = `${totalDiscountPct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  if ($("kpiCommissionPct")) $("kpiCommissionPct").textContent = `${commissionInfo.finalPct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  if ($("directorSummary")) {
    $("directorSummary").innerHTML = `
      <div class="summaryRow"><span>Modelo</span><b>${getCommissionPolicy().label}</b></div>
      <div class="summaryRow"><span>Total sem juros</span><b>${brl(cashFinalTotalNoFreight)}</b></div>
      <div class="summaryRow"><span>Desconto</span><b>${brl(discountValue)}</b></div>
      ${freight > 0 ? `<div class="summaryRow"><span>Frete</span><b>${brl(freight)}</b></div>` : ""}
      <div class="summaryRow final"><span>Total final negociado</span><b>${brl(finalTotal)}</b></div>
      <div class="summaryRow"><span>Comissao Final</span><b>${brl(commission)}</b></div>`;
  }
  calcFinance(finalTotal);
  renderCommission(finalTotal, grossTotal, totalDiscountPct);
}

function renderHistory() {
  $("historyBody").innerHTML = state.proposals.map((proposal) => `
    <tr>
      <td><b>${proposal.code}</b><br><span class="statusPill ${isOrder(proposal) ? "order" : ""}">${isOrder(proposal) ? "Pedido" : "Proposta"}</span></td><td>${proposal.customer.name}<br><small>${proposal.customer.company || ""}</small></td>
      <td class="moneyCell">${brl(proposal.total)}</td><td>${proposal.createdByName}</td><td>${proposal.createdAtLabel}</td>
      <td><div class="rowActions"><button class="secondaryBtn" data-edit-proposal="${proposal.id}">Editar</button><button class="secondaryBtn" data-pdf="${proposal.id}">PDF</button>${isOrder(proposal) ? "" : `<button class="primaryTiny" data-order-proposal="${proposal.id}">Gerar pedido</button>`}${can("deleteProposals") ? `<button class="dangerTiny" data-delete-proposal="${proposal.id}">Excluir</button>` : ""}</div></td>
    </tr>`).join("");
  $("emptyHistory").style.display = state.proposals.length ? "none" : "block";
  document.querySelectorAll("[data-edit-proposal]").forEach((button) => button.addEventListener("click", () => loadProposalForEdit(button.dataset.editProposal)));
  document.querySelectorAll("[data-pdf]").forEach((button) => button.addEventListener("click", () => window.open(`/api/proposals/${button.dataset.pdf}/pdf`, "_blank")));
  document.querySelectorAll("[data-order-proposal]").forEach((button) => button.addEventListener("click", () => markProposalAsOrder(button.dataset.orderProposal)));
  document.querySelectorAll("[data-delete-proposal]").forEach((button) => button.addEventListener("click", () => deleteProposal(button.dataset.deleteProposal)));
}

function renderClients() {
  const byName = new Map();
  state.proposals.forEach((proposal) => {
    if (proposal.customer?.name) byName.set(proposal.customer.name, proposal.customer);
  });
  const clients = [...byName.values()];
  $("clientsList").innerHTML = clients.map((client) => (
    `<div class="infoCard"><b>${client.name}</b><span>${client.company || "Sem fazenda informada"}</span><small>${client.phone || ""} ${client.city || ""}</small></div>`
  )).join("") || "<div class='emptyState compact'>Clientes aparecem aqui quando uma proposta e salva.</div>";
}

function renderReports() {
  const orders = orderProposals();
  const total = orders.reduce((sum, proposal) => sum + Number(proposal.total || 0), 0);
  const pending = state.proposals.filter((proposal) => !isOrder(proposal));
  const items = orders.reduce((sum, proposal) => sum + proposal.items.length, 0);
  const byCultivar = new Map();
  orders.forEach((proposal) => (proposal.items || []).forEach((item) => {
    const key = `${item.line || ""} | ${item.product || ""} | ${item.standard || ""}`;
    const current = byCultivar.get(key) || { line: item.line || "", product: item.product || "", standard: item.standard || "", quantity: 0, total: 0 };
    current.quantity += Number(item.quantity || 0);
    current.total += Number(item.total || 0);
    byCultivar.set(key, current);
  }));
  const sellerRows = [...orders.reduce((map, proposal) => {
    const key = proposal.createdBy || proposal.createdByName || "sem-id";
    const current = map.get(key) || { seller: proposal.createdByName || "Vendedor", orders: 0, total: 0 };
    current.orders += 1;
    current.total += Number(proposal.total || 0);
    map.set(key, current);
    return map;
  }, new Map()).values()];
  $("reportsGrid").innerHTML = `
    <div class="reportKpis">
      <div class="infoCard"><small>Total em pedidos</small><b>${brl(total)}</b></div>
      <div class="infoCard"><small>Pedidos gerados</small><b>${orders.length}</b></div>
      <div class="infoCard"><small>Propostas em aberto</small><b>${pending.length}</b></div>
      <div class="infoCard"><small>Itens em pedidos</small><b>${items}</b></div>
    </div>
    <div class="reportGrid">
      <div class="reportPanel"><h3>Pedidos por vendedor</h3><div class="reportList">${sellerRows.map((row) => `<div class="reportLine"><div><b>${html(row.seller)}</b><small>${row.orders} pedido(s)</small></div><strong>${brl(row.total)}</strong></div>`).join("") || `<div class="emptyState compact">Sem pedidos ainda.</div>`}</div></div>
      <div class="reportPanel"><h3>Pedidos por cultivar</h3><div class="reportList">${[...byCultivar.values()].sort((a, b) => b.total - a.total).map((row) => `<div class="reportLine"><div><b>${html(row.product)}</b><small>${html(row.line)} - ${html(row.standard)} - ${row.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg</small></div><strong>${brl(row.total)}</strong></div>`).join("") || `<div class="emptyState compact">Sem cultivares em pedido.</div>`}</div></div>
    </div>
    <div class="reportPanel wideReport"><h3>Relatorio de pedidos</h3><div class="orderReportList">${orders.map((proposal) => `<div class="orderReportCard"><div><small>Pedido</small><b>${html(proposal.code)}</b></div><div><small>Cliente</small><b>${html(proposal.customer?.name || "")}</b><span>${html(proposal.customer?.company || "")}</span></div><div><small>Vendedor</small><b>${html(proposal.createdByName || "")}</b><span>${html(proposal.orderCreatedAtLabel || proposal.createdAtLabel || "")}</span></div><div><small>Cultivares</small><span>${(proposal.items || []).map((item) => `${html(item.product)} ${html(item.standard)}`).join("<br>")}</span></div><div class="orderTotal"><small>Total</small><b>${brl(proposal.total)}</b></div></div>`).join("") || `<div class="emptyState compact">Gere pedidos para alimentar o relatorio.</div>`}</div></div>`;
}

function permissionCheckboxes(selected = []) {
  return modules.map(([id, label]) => `
    <label class="check"><input type="checkbox" value="${id}" ${selected.includes(id) ? "checked" : ""}>${permissionLabels[id] || label}</label>`
  ).join("") + Object.entries(permissionLabels)
    .filter(([id]) => !modules.some(([moduleId]) => moduleId === id))
    .map(([id, label]) => `<label class="check sensitivePerm"><input type="checkbox" value="${id}" ${selected.includes(id) ? "checked" : ""}>${label}</label>`)
    .join("");
}

function profileOptions(selected = "") {
  const current = selected || "Representante Comercial";
  const options = userProfiles.includes(current) ? userProfiles : [current, ...userProfiles];
  return options.map((profile) => `<option value="${profile}" ${profile === current ? "selected" : ""}>${profile}</option>`).join("");
}

function commissionRowsForProposal(proposal) {
  const financial = proposal.financial || {};
  const policy = commissionPolicies[financial.saleModel] || commissionPolicies.revenda;
  const base = Number(proposal.totalWithoutFreight || proposal.total || 0);
  const gross = (proposal.items || []).reduce((sum, item) => sum + Number(item.grossTotal || 0), 0);
  const discountPct = gross > 0 ? Number(proposal.discount || 0) / gross * 100 : Number(financial.discountPct || 0);
  const maxDiscount = Number(policy.maxDiscount || 0);
  const discountOnCommission = Math.min(Math.max(0, discountPct), maxDiscount);
  return policy.rows.map(([participant, pct, negotiable, floorPct]) => {
    const minimum = Number(floorPct || 0);
    const finalPct = negotiable && maxDiscount > 0
      ? Math.max(minimum, pct - ((pct - minimum) * (discountOnCommission / maxDiscount)))
      : pct;
    return {
      proposal,
      base,
      channel: financial.saleModelLabel || policy.label,
      participant,
      pct: finalPct,
      commission: round2(base * finalPct / 100)
    };
  });
}

function renderCommissionsDashboard() {
  if (!$("commissionsGrid") || !can("commissions")) return;
  const bySeller = new Map();
  const commissionDetails = [];
  const orders = orderProposals();
  orders.forEach((proposal) => {
    const key = proposal.createdBy || proposal.createdByName || "sem-id";
    const user = state.users.find((item) => item.id === proposal.createdBy || item.name === proposal.createdByName) || {};
    const current = bySeller.get(key) || {
      name: proposal.createdByName || user.name || "Usuario",
      role: user.role || "Sem perfil",
      proposals: 0,
      volume: 0,
      commission: 0
    };
    const rows = commissionRowsForProposal(proposal);
    commissionDetails.push(...rows);
    const volume = Number(proposal.totalWithoutFreight || proposal.total || 0);
    const commission = rows.reduce((sum, row) => sum + row.commission, 0);
    current.proposals += 1;
    current.volume += volume;
    current.commission += commission;
    bySeller.set(key, current);
  });
  state.users.forEach((user) => {
    const existingKey = [...bySeller.entries()].find(([, row]) => row.name === user.name || (user.email && row.email === user.email))?.[0];
    const key = existingKey || user.id || user.name;
    if (!bySeller.has(key)) {
      bySeller.set(key, {
        id: user.id,
        name: user.name || "Usuario",
        email: user.email || "",
        role: user.role || "Sem perfil",
        active: user.active !== false,
        proposals: 0,
        volume: 0,
        commission: 0
      });
    } else {
      const current = bySeller.get(key);
      current.id = user.id;
      current.email = user.email || "";
      current.role = user.role || current.role;
      current.active = user.active !== false;
    }
  });
  const rows = [...bySeller.values()].sort((a, b) => b.volume - a.volume || a.name.localeCompare(b.name));
  const totalVolume = rows.reduce((sum, row) => sum + row.volume, 0);
  const totalCommission = rows.reduce((sum, row) => sum + row.commission, 0);
  const activeUsers = rows.filter((row) => row.active !== false).length;
  $("commissionsGrid").innerHTML = `
    <div class="infoCard"><small>Volume em pedidos</small><b>${brl(totalVolume)}</b></div>
    <div class="infoCard"><small>Comissao sobre pedidos</small><b>${brl(totalCommission)}</b></div>
    <div class="infoCard"><small>Colaboradores ativos</small><b>${activeUsers}</b></div>
    <div class="infoCard"><small>Pedidos gerados</small><b>${orders.length}</b></div>`;
  if ($("commissionUserRole")) $("commissionUserRole").innerHTML = profileOptions("Representante Comercial");
  if ($("commissionUserPanel")) $("commissionUserPanel").classList.toggle("hidden", !can("users"));
  $("commissionsBody").innerHTML = rows.map((row) => `
    <tr data-commission-user="${row.id || ""}">
      <td><b>${row.name}</b><br><small>${row.email || "Sem e-mail cadastrado"}</small></td>
      <td>${row.id && can("users") ? `<select class="commissionRole">${profileOptions(row.role)}</select>` : row.role}</td>
      <td>${row.proposals}</td>
      <td class="moneyCell">${brl(row.volume)}</td>
      <td class="moneyCell">${brl(row.commission)}</td>
      <td>${row.id && can("users") ? `<label class="check compactCheck"><input class="commissionActive" type="checkbox" ${row.active !== false ? "checked" : ""}>Ativo</label>` : (row.active === false ? "Inativo" : "Ativo")}</td>
      <td><div class="rowActions"><button class="secondaryBtn commissionReportBtn" data-seller="${html(row.name)}">PDF</button>${row.id && can("users") ? `<button class="secondaryBtn commissionSaveBtn">Salvar</button><button class="dangerTiny commissionDeleteBtn">Excluir</button>` : ""}</div></td>
    </tr>`).join("") || `<tr><td colspan="7" class="emptyState compact">As comissoes aparecem quando a proposta virar pedido.</td></tr>`;
  document.querySelectorAll("[data-commission-user]").forEach((row) => {
    row.querySelector(".commissionReportBtn")?.addEventListener("click", () => openSellerCommissionReport(row.querySelector(".commissionReportBtn").dataset.seller));
    if (!row.dataset.commissionUser || !can("users")) return;
    row.querySelector(".commissionSaveBtn")?.addEventListener("click", async () => {
      const user = state.users.find((item) => item.id === row.dataset.commissionUser);
      const payload = {
        name: user.name,
        email: user.email,
        role: row.querySelector(".commissionRole").value,
        active: row.querySelector(".commissionActive").checked,
        permissions: user.permissions || []
      };
      const data = await api(`/api/users/${row.dataset.commissionUser}`, { method: "PATCH", body: JSON.stringify(payload) });
      state.users = data.users;
      renderCommissionsDashboard();
      renderUsers();
      refreshActivity();
    });
    row.querySelector(".commissionDeleteBtn")?.addEventListener("click", async () => {
      if (!confirm("Excluir este colaborador?")) return;
      const data = await api(`/api/users/${row.dataset.commissionUser}`, { method: "DELETE" });
      state.users = data.users;
      renderCommissionsDashboard();
      renderUsers();
      refreshActivity();
    });
  });
  if ($("commissionDetailsBody")) {
    $("commissionDetailsBody").innerHTML = commissionDetails.map((row) => `
      <tr>
        <td><b>${row.proposal.code}</b></td>
        <td>${row.proposal.customer?.name || ""}</td>
        <td>${row.proposal.orderCreatedAtLabel || row.proposal.createdAtLabel || ""}</td>
        <td>${row.proposal.createdByName || ""}</td>
        <td>${row.channel}</td>
        <td><b>${row.participant}</b></td>
        <td class="moneyCell">${row.pct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
        <td class="moneyCell">${brl(row.base)}</td>
        <td class="moneyCell">${brl(row.commission)}</td>
      </tr>`).join("") || `<tr><td colspan="9" class="emptyState compact">As comissoes aparecem somente depois de gerar pedido.</td></tr>`;
  }
}

function openSellerCommissionReport(sellerName) {
  const orders = orderProposals().filter((proposal) => (proposal.createdByName || "Usuario") === sellerName);
  const details = orders.flatMap((proposal) => commissionRowsForProposal(proposal));
  const totalVolume = orders.reduce((sum, proposal) => sum + Number(proposal.totalWithoutFreight || proposal.total || 0), 0);
  const totalCommission = details.reduce((sum, row) => sum + Number(row.commission || 0), 0);
  const win = window.open("", "_blank");
  if (!win) return;
  const orderRows = orders.map((proposal) => `
    <tr>
      <td>${html(proposal.code)}</td>
      <td>${html(proposal.customer?.name || "")}</td>
      <td>${html(proposal.orderCreatedAtLabel || proposal.createdAtLabel || "")}</td>
      <td>${(proposal.items || []).map((item) => `${html(item.product)} ${html(item.standard)}`).join("<br>")}</td>
      <td class="num">${brl(proposal.totalWithoutFreight || proposal.total)}</td>
    </tr>`).join("");
  const detailRows = details.map((row) => `
    <tr>
      <td>${html(row.proposal.code)}</td>
      <td>${html(row.participant)}</td>
      <td class="num">${row.pct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
      <td class="num">${brl(row.base)}</td>
      <td class="num">${brl(row.commission)}</td>
    </tr>`).join("");
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comissoes - ${html(sellerName)}</title><style>
    @page{size:A4;margin:10mm}body{font-family:Arial,Segoe UI,sans-serif;color:#102316;margin:0;font-size:12px}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #063d21;padding-bottom:12px;margin-bottom:16px}h1{color:#063d21;margin:0;font-size:22px;text-transform:uppercase}h2{color:#063d21;font-size:14px;text-transform:uppercase;margin:18px 0 8px}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.kpi{border:1px solid #d7e2d7;border-radius:8px;padding:12px}.kpi small{display:block;text-transform:uppercase;color:#66736a;font-weight:800}.kpi b{display:block;color:#063d21;font-size:18px;margin-top:5px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d7e2d7;padding:7px;text-align:left;vertical-align:top}th{background:#f5f8f5;text-transform:uppercase;font-size:10px}.num{text-align:right;font-weight:900;white-space:nowrap}.no-print{position:fixed;right:16px;top:16px;background:#063d21;color:#fff;border:0;border-radius:6px;padding:10px 14px;font-weight:800}@media print{.no-print{display:none}}
  </style></head><body><button class="no-print" onclick="window.print()">Salvar em PDF</button><div class="top"><div><h1>Relatorio individual de comissoes</h1><b>${html(sellerName)}</b></div><div>${new Date().toLocaleString("pt-BR")}</div></div><div class="kpis"><div class="kpi"><small>Pedidos</small><b>${orders.length}</b></div><div class="kpi"><small>Volume em pedidos</small><b>${brl(totalVolume)}</b></div><div class="kpi"><small>Comissao total</small><b>${brl(totalCommission)}</b></div></div><h2>Pedidos de compra</h2><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Cultivares</th><th>Valor</th></tr></thead><tbody>${orderRows || `<tr><td colspan="5">Nenhum pedido gerado para este vendedor.</td></tr>`}</tbody></table><h2>Comissoes calculadas</h2><table><thead><tr><th>Pedido</th><th>Participante</th><th>%</th><th>Base</th><th>Comissao</th></tr></thead><tbody>${detailRows || `<tr><td colspan="5">Sem comissoes calculadas.</td></tr>`}</tbody></table><script>setTimeout(() => window.print(), 500);</script></body></html>`);
  win.document.close();
}

function renderUsers() {
  if (!can("users")) return;
  $("newUserPerms").innerHTML = permissionCheckboxes(profilePermissions["Representante Comercial"]);
  if ($("newUserRole") && $("newUserRole").tagName === "SELECT") $("newUserRole").innerHTML = profileOptions("Representante Comercial");
  $("usersList").innerHTML = state.users.map((user) => `
    <div class="userCard" data-user="${user.id}">
      <div class="userEditGrid">
        <label>Nome<input class="editUserName" value="${user.name || ""}"></label>
        <label>E-mail<input class="editUserEmail" value="${user.email || ""}"></label>
        <label>Perfil<select class="editUserRole">${profileOptions(user.role)}</select></label>
        <label>Nova senha<input class="editUserPassword" placeholder="Manter senha atual"></label>
        <label class="check statusCheck"><input class="editUserActive" type="checkbox" ${user.active ? "checked" : ""}>Usuario ativo</label>
        <label class="check statusCheck"><input class="editUserMustChange" type="checkbox" ${user.mustChangePassword ? "checked" : ""}>Senha provisoria</label>
      </div>
      <div class="permGrid">${permissionCheckboxes(user.permissions || [])}</div>
      <div class="rowActions"><button class="secondaryBtn savePermBtn">Salvar usuario</button><button class="dangerTiny deleteUserBtn">Excluir usuario</button></div>
    </div>`).join("");
  document.querySelectorAll(".userCard").forEach((card) => {
    card.querySelector(".editUserRole")?.addEventListener("change", () => {
      const defaults = profilePermissions[card.querySelector(".editUserRole").value] || [];
      card.querySelectorAll(".permGrid input").forEach((input) => { input.checked = defaults.includes(input.value); });
    });
    card.querySelector(".savePermBtn").addEventListener("click", async () => {
      const permissions = [...card.querySelectorAll(".permGrid input:checked")].map((input) => input.value);
      const payload = {
        name: card.querySelector(".editUserName").value.trim(),
        email: card.querySelector(".editUserEmail").value.trim(),
        role: card.querySelector(".editUserRole").value.trim(),
        active: card.querySelector(".editUserActive").checked,
        mustChangePassword: card.querySelector(".editUserMustChange").checked,
        permissions
      };
      const password = card.querySelector(".editUserPassword").value;
      if (password) payload.password = password;
      const data = await api(`/api/users/${card.dataset.user}`, { method: "PATCH", body: JSON.stringify(payload) });
      state.users = data.users;
      renderUsers();
      renderCommissionsDashboard();
      refreshActivity();
    });
    card.querySelector(".deleteUserBtn").addEventListener("click", async () => {
      if (!confirm("Excluir este usuario?")) return;
      const data = await api(`/api/users/${card.dataset.user}`, { method: "DELETE" });
      state.users = data.users;
      renderUsers();
      renderCommissionsDashboard();
      refreshActivity();
    });
  });
  $("newUserRole")?.addEventListener("change", () => {
    const defaults = profilePermissions[$("newUserRole").value] || [];
    $("newUserPerms").querySelectorAll("input").forEach((input) => { input.checked = defaults.includes(input.value); });
  });
}

function renderActivity() {
  if (!$("activityList") || !can("users")) return;
  const labels = {
    login: "Entrou no sistema",
    logout: "Saiu do sistema",
    abriu_dashboard: "Abriu o dashboard oficial",
    abriu_admin: "Abriu usuarios/permissoes",
    usuario_criado: "Criou usuario",
    usuario_alterado: "Alterou usuario",
    usuario_excluido: "Excluiu usuario",
    proposta_salva: "Salvou proposta",
    proposta_alterada: "Alterou proposta",
    pedido_gerado: "Gerou pedido",
    proposta_excluida: "Excluiu proposta"
  };
  $("activityList").innerHTML = (state.activityLogs || []).map((item) => {
    const detail = item.details || {};
    const extra = detail.codigo || detail.usuario || detail.cliente || detail.email || detail.pagina || "";
    return `<div class="activityItem">
      <div><b>${item.userName || "Usuario"}</b><span>${labels[item.action] || item.action}</span>${extra ? `<small>${extra}</small>` : ""}</div>
      <time>${item.createdAtLabel || ""}</time>
    </div>`;
  }).join("") || "<div class='emptyState compact'>Nenhuma atividade registrada ainda.</div>";
}

async function refreshActivity() {
  if (!$("activityList") || !can("users")) return;
  const data = await api("/api/activity");
  state.activityLogs = data.activityLogs || [];
  renderActivity();
}

function clearProposal() {
  ["customerName", "customerCompany", "customerDocument", "customerStateRegistration", "customerAddress", "customerZip", "customerPhone", "customerEmail", "customerCity"].forEach((id) => { if ($(id)) $(id).value = ""; });
  state.editingProposalId = null;
  state.attachments = [];
  renderAttachments();
  $("itemsBody").innerHTML = "";
  addItem();
  if ($("saveProposalBtn")) $("saveProposalBtn").textContent = "SALVAR";
}

function loadProposalForEdit(id) {
  const proposal = state.proposals.find((item) => item.id === id);
  if (!proposal) return;
  state.editingProposalId = id;
  const customer = proposal.customer || {};
  const financial = proposal.financial || {};
  const fields = {
    customerName: customer.name,
    customerCompany: customer.company,
    customerDocument: customer.document,
    customerStateRegistration: customer.stateRegistration,
    customerAddress: customer.address,
    customerZip: customer.zip,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    customerCity: customer.city,
    proposalDate: customer.proposalDate,
    payment: proposal.payment,
    validity: proposal.validity,
    notes: proposal.notes,
    saleModel: financial.saleModel,
    discountPct: financial.discountPct,
    financeEntry: financial.entryPct,
    entryDate: financial.entryDate,
    financeInterest: financial.interestPct,
    financeInstallments: financial.installments,
    marginPct: financial.marginPct,
    freightValue: financial.freightValue
  };
  Object.entries(fields).forEach(([id, value]) => {
    if ($(id) && value !== undefined && value !== null) $(id).value = value;
  });
  if ($("freightEnabled")) $("freightEnabled").checked = !!financial.freightEnabled;
  state.attachments = Array.isArray(proposal.attachments) ? proposal.attachments : [];
  renderAttachments();
  $("itemsBody").innerHTML = "";
  (proposal.items || []).forEach((item) => {
    const product = state.products.find((product) => product.linha === item.line && product.produto === item.product && String(product.tecnologia) === String(item.standard))
      || state.products.find((product) => product.linha === item.line && product.produto === item.product)
      || state.products[0];
    addItem(product);
    const row = $("itemsBody").querySelector("tr:last-child");
    if (!row) return;
    row.querySelector(".lineSelect").value = item.line || product.linha;
    row.querySelector(".cultivarSelect").value = item.product || product.produto;
    row.querySelector(".standardSelect").value = item.standard || product.tecnologia;
    row.querySelector(".packageInput").value = item.package || product.apresentacao || "";
    row.querySelector(".quantityInput").value = item.quantity || 0;
    row.querySelector(".priceInput").value = Number(item.unitPrice || 0).toFixed(2);
    row.querySelector(".itemDiscountInput").value = Number(item.discountPct || 0).toFixed(2);
    updateRowDisplay(row, product);
  });
  if (!$("itemsBody").querySelector("tr")) addItem();
  if (Array.isArray(financial.installmentSchedule) && financial.installmentSchedule.length) {
    calculateTotals();
    document.querySelectorAll(".installmentRow").forEach((row, index) => {
      const item = financial.installmentSchedule[index];
      if (!item) return;
      const dateInput = row.querySelector(".installmentDateInput");
      const amountInput = row.querySelector(".installmentAmountInput");
      if (dateInput) dateInput.value = item.date || "";
      if (amountInput) {
        amountInput.value = Number(item.amount || 0).toFixed(2);
        amountInput.dataset.manual = "true";
      }
    });
  }
  calculateTotals();
  if ($("saveProposalBtn")) $("saveProposalBtn").textContent = `ATUALIZAR ${proposal.code}`;
  showPage("proposal");
}

async function saveProposal(options = {}) {
  const shouldOpenPdf = !!options.openPdf;
  const shouldMarkOrder = !!options.markOrder;
  const pdfWindow = shouldOpenPdf ? window.open("about:blank", "_blank") : null;
  $("formError").textContent = "";
  const payload = {
    customer: {
      name: $("customerName").value.trim(),
      company: $("customerCompany").value.trim(),
      document: $("customerDocument").value.trim(),
      stateRegistration: $("customerStateRegistration").value.trim(),
      address: $("customerAddress").value.trim(),
      zip: $("customerZip").value.trim(),
      phone: $("customerPhone").value.trim(),
      email: $("customerEmail").value.trim(),
      city: $("customerCity").value.trim(),
      proposalDate: $("proposalDate").value
    },
    payment: $("payment").value.trim(),
    validity: $("validity").value.trim(),
    notes: $("notes").value.trim(),
    items: readItems(),
    financial: collectFinancial(),
    attachments: state.attachments
  };
  try {
    const method = state.editingProposalId ? "PUT" : "POST";
    const path = state.editingProposalId ? `/api/proposals/${state.editingProposalId}` : "/api/proposals";
    const data = await api(path, { method, body: JSON.stringify(payload) });
    if (state.editingProposalId) state.proposals = data.proposals || state.proposals.map((item) => item.id === data.proposal.id ? data.proposal : item);
    else state.proposals.unshift(data.proposal);
    if (shouldMarkOrder) {
      const orderData = await api(`/api/proposals/${data.proposal.id}/order`, { method: "POST" });
      state.proposals = orderData.proposals || state.proposals.map((item) => item.id === orderData.proposal.id ? orderData.proposal : item);
    }
    renderAll(data.nextCode);
    clearProposal();
    showPage(shouldMarkOrder ? "commissions" : "history");
    if (shouldOpenPdf) {
      const pdfUrl = `/api/proposals/${data.proposal.id}/pdf`;
      if (pdfWindow) pdfWindow.location.href = pdfUrl;
      else window.open(pdfUrl, "_blank");
    }
  } catch (error) {
    if (pdfWindow) pdfWindow.close();
    $("formError").textContent = error.message;
  }
}

async function markProposalAsOrder(id) {
  const proposal = state.proposals.find((item) => item.id === id);
  if (!proposal) return;
  if (!confirm(`Gerar pedido de compra para ${proposal.code}? A partir disso ele entra no comissionamento.`)) return;
  const data = await api(`/api/proposals/${id}/order`, { method: "POST" });
  state.proposals = data.proposals || state.proposals.map((item) => item.id === data.proposal.id ? data.proposal : item);
  renderAll();
  showPage("commissions");
}

async function createUser() {
  $("userError").textContent = "";
  const permissions = [...$("newUserPerms").querySelectorAll("input:checked")].map((input) => input.value);
  try {
    const data = await api("/api/users", {
      method: "POST",
      body: JSON.stringify({
        name: $("newUserName").value.trim(),
        email: $("newUserEmail").value.trim(),
        password: $("newUserPassword").value,
        role: $("newUserRole").value.trim(),
        mustChangePassword: true,
        permissions
      })
    });
    state.users = data.users;
    renderStats();
    renderUsers();
    renderCommissionsDashboard();
    refreshActivity();
  } catch (error) {
    $("userError").textContent = error.message;
  }
}

async function createCommissionUser() {
  if (!$("commissionUserError")) return;
  $("commissionUserError").textContent = "";
  try {
    const data = await api("/api/users", {
      method: "POST",
      body: JSON.stringify({
        name: $("commissionUserName").value.trim(),
        email: $("commissionUserEmail").value.trim(),
        password: $("commissionUserPassword").value || "123456",
        role: $("commissionUserRole").value,
        mustChangePassword: true,
        permissions: profilePermissions[$("commissionUserRole").value] || profilePermissions["Representante Comercial"]
      })
    });
    state.users = data.users;
    ["commissionUserName", "commissionUserEmail"].forEach((id) => { if ($(id)) $(id).value = ""; });
    if ($("commissionUserPassword")) $("commissionUserPassword").value = "123456";
    renderCommissionsDashboard();
    renderUsers();
    refreshActivity();
  } catch (error) {
    $("commissionUserError").textContent = error.message;
  }
}

async function deleteProposal(id) {
  if (!confirm("Excluir esta proposta do historico?")) return;
  const data = await api(`/api/proposals/${id}`, { method: "DELETE" });
  state.proposals = data.proposals;
  renderAll();
}

async function downloadBackup() {
  const data = await api("/api/backup");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `backup-riza-agro-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function restoreBackup(file) {
  if (!file) return;
  if (!confirm("Restaurar este backup vai substituir usuarios e propostas atuais. Continuar?")) return;
  const content = await file.text();
  const data = await api("/api/backup", { method: "POST", body: content });
  alert(`Backup restaurado: ${data.users} usuarios e ${data.proposals} propostas.`);
  location.reload();
}

function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      content: String(reader.result || "")
    });
    reader.onerror = () => reject(new Error(`Nao foi possivel anexar ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function renderAttachments() {
  if (!$("attachmentList")) return;
  if (!state.attachments.length) {
    $("attachmentList").innerHTML = `<div class="emptyState compact">Nenhum documento anexado.</div>`;
    return;
  }
  $("attachmentList").innerHTML = state.attachments.map((file) => (
    `<div class="attachmentItem"><span>${file.name}</span><small>${(file.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB</small><button type="button" data-remove-attachment="${file.id}">Remover</button></div>`
  )).join("");
  document.querySelectorAll("[data-remove-attachment]").forEach((button) => button.addEventListener("click", () => {
    state.attachments = state.attachments.filter((file) => file.id !== button.dataset.removeAttachment);
    renderAttachments();
  }));
}

async function addAttachments(files) {
  const selected = [...files];
  if (!selected.length) return;
  const incoming = await Promise.all(selected.map(fileToAttachment));
  state.attachments = [...state.attachments, ...incoming];
  renderAttachments();
  if ($("attachmentInput")) $("attachmentInput").value = "";
}

function collectFinancial() {
  const freight = $("freightEnabled")?.checked ? round2(Math.max(0, Number($("freightValue")?.value || 0))) : 0;
  return {
    discountPct: Math.min(integerDiscount($("discountPct")?.value || 0), discountLimitForCurrentUser(getCommissionPolicy())),
    entryPct: Number($("financeEntry")?.value || 0),
    entryDate: $("entryDate")?.value || "",
    interestPct: Number($("financeInterest")?.value || 0),
    installments: Number($("financeInstallments")?.value || 0),
    paymentHorizonMonths: paymentHorizonMonths(),
    paymentHorizonDays: paymentHorizonDays(),
    totalWithoutInterest: state.currentTotals?.cashFinalTotal || 0,
    totalWithInterest: state.currentTotals?.finalTotal || 0,
    freightEnabled: $("freightEnabled")?.checked || false,
    freightValue: freight,
    commissionBasePct: Number($("commissionBase")?.value || 7.18),
    commissionFinalPct: Number($("commissionFinal")?.value || 7.18),
    marginPct: Number($("marginPct")?.value || 15),
    saleModel: $("saleModel")?.value || "revenda",
    saleModelLabel: getCommissionPolicy().label,
    installmentSchedule: [...document.querySelectorAll(".installmentRow")].map((row, index) => ({
      label: `Parcela ${index + 1}`,
      date: row.querySelector(".installmentDateInput")?.value || "",
      amount: round2(Number(row.querySelector(".installmentAmountInput")?.value || 0))
    }))
  };
}

function calcFinance(finalTotal = null) {
  if (!$("financeResult")) return;
  const base = finalTotal ?? currentProposalTotal();
  const entryPct = Number($("financeEntry")?.value || 0);
  const rawInstallments = Number($("financeInstallments")?.value || 0);
  const entry = round2(base * entryPct / 100);
  const parcelTotal = round2(Math.max(0, base - entry));
  const cashTotal = state.currentTotals?.cashFinalTotal || base;
  if ($("entryDateLabel")) $("entryDateLabel").classList.toggle("hidden", entryPct <= 0);
  $("financeResult").innerHTML = `<b>Total sem juros<br>${brl(cashTotal)}</b><b>Entrada<br>${brl(entry)}</b><b>Valor parcelado<br>${brl(parcelTotal)}</b>`;
  renderInstallments(parcelTotal, rawInstallments);
}

function renderInstallments(amount, count) {
  if (!$("installmentsBox")) return;
  const previous = [...document.querySelectorAll(".installmentRow")].map((row) => ({
    date: row.querySelector(".installmentDateInput")?.value || "",
    amount: row.querySelector(".installmentAmountInput")?.value || "",
    manualAmount: row.querySelector(".installmentAmountInput")?.dataset.manual === "true"
  }));
  if (!count || count <= 0) {
    $("installmentsBox").innerHTML = `<div class="emptyState compact">Informe o numero de parcelas para gerar as datas.</div>`;
    return;
  }
  const baseDate = $("entryDate")?.value ? new Date(`${$("entryDate").value}T00:00:00`) : new Date();
  const defaultAmount = count > 0 ? round2(amount / count) : 0;
  const rows = Array.from({ length: count }, (_, index) => {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + index + 1);
    const isoDate = previous[index]?.date || date.toISOString().slice(0, 10);
    const adjustedLast = index === count - 1 ? round2(amount - defaultAmount * (count - 1)) : defaultAmount;
    const isManual = previous[index]?.manualAmount;
    const value = isManual ? previous[index].amount : adjustedLast.toFixed(2);
    return `<tr class="installmentRow">
      <td>Parcela ${index + 1}</td>
      <td><input class="installmentDateInput" type="date" value="${isoDate}"></td>
      <td><input class="installmentAmountInput" type="number" min="0" step="0.01" value="${value}" ${isManual ? 'data-manual="true"' : ""}></td>
    </tr>`;
  }).join("");
  $("installmentsBox").innerHTML = `<h3>Cronograma de parcelas</h3><table><thead><tr><th>Parcela</th><th>Data</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>`;
  $("installmentsBox").querySelectorAll(".installmentDateInput").forEach((input) => input.addEventListener("change", calculateTotals));
  $("installmentsBox").querySelectorAll(".installmentAmountInput").forEach((input) => input.addEventListener("change", () => {
    input.dataset.manual = "true";
    calculateTotals();
  }));
}

function getCommissionTotals(discountPct = 0) {
  const policy = getCommissionPolicy();
  const basePct = policy.rows.reduce((sum, row) => sum + row[1], 0);
  const maxDiscount = Number(policy.maxDiscount || 0);
  const discountOnCommission = Math.min(Math.max(0, discountPct), maxDiscount);
  const finalPct = policy.rows.reduce((sum, row) => {
    const [name, pct, negotiable, floorPct] = row;
    if (!negotiable || maxDiscount <= 0) return sum + pct;
    const minimum = Number(floorPct || 0);
    const reduced = pct - ((pct - minimum) * (discountOnCommission / maxDiscount));
    return sum + Math.max(minimum, reduced);
  }, 0);
  return { policy, basePct, finalPct, discountOnCommission, maxDiscount };
}

function renderCommission(finalTotal, grossTotal = finalTotal, discountPct = 0) {
  const { policy, basePct, finalPct, discountOnCommission, maxDiscount } = getCommissionTotals(discountPct);
  if ($("commissionChannel")) $("commissionChannel").innerHTML = `${policy.label}<br><small>${policy.subtitle}</small>`;
  if ($("commissionBaseBox")) $("commissionBaseBox").textContent = `${basePct.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`;
  if ($("commissionFinalBox")) $("commissionFinalBox").textContent = `${finalPct.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`;
  if ($("commissionBase")) $("commissionBase").value = basePct.toFixed(2);
  if ($("commissionFinal")) $("commissionFinal").value = finalPct.toFixed(2);
  if (!$("commissionRows")) return;
  $("commissionRows").innerHTML = policy.rows.map(([name, pct, negotiable, floorPct]) => {
    const minimum = Number(floorPct || 0);
    const finalRowPct = negotiable && maxDiscount > 0
      ? Math.max(minimum, pct - ((pct - minimum) * (discountOnCommission / maxDiscount)))
      : pct;
    return `<tr><td>${name}</td><td>${pct.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</td><td>${finalRowPct.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</td><td class="moneyCell">${brl(finalTotal * finalRowPct / 100)}</td></tr>`;
  }).join("");
}

function renderAll(nextCode) {
  renderSensitiveUi();
  renderStats(nextCode);
  renderProducts();
  renderHistory();
  renderClients();
  renderReports();
  renderCommissionsDashboard();
  renderUsers();
  renderActivity();
}

function showPasswordModal() {
  if (!$("passwordModal")) {
    document.body.insertAdjacentHTML("beforeend", `
      <section id="passwordModal" class="passwordModal hidden">
        <form id="passwordForm" class="passwordCard">
          <small>Primeiro acesso</small>
          <h2>Troque sua senha provisoria</h2>
          <p>Para proteger sua conta, defina uma nova senha antes de continuar.</p>
          <label>Nova senha<input id="newPassword" type="password" autocomplete="new-password" minlength="6" placeholder="Minimo 6 caracteres"></label>
          <label>Confirmar nova senha<input id="confirmPassword" type="password" autocomplete="new-password" minlength="6" placeholder="Repita a senha"></label>
          <button type="submit" class="primaryBtn">Salvar nova senha</button>
          <div id="passwordError" class="error"></div>
        </form>
      </section>
    `);
    $("passwordForm").addEventListener("submit", changePassword);
  }
  $("passwordModal").classList.remove("hidden");
  if ($("newPassword")) $("newPassword").focus();
}

function hidePasswordModal() {
  if ($("passwordModal")) $("passwordModal").classList.add("hidden");
  if ($("newPassword")) $("newPassword").value = "";
  if ($("confirmPassword")) $("confirmPassword").value = "";
  if ($("passwordError")) $("passwordError").textContent = "";
}

async function changePassword(event) {
  event.preventDefault();
  $("passwordError").textContent = "";
  try {
    const data = await api("/api/change-password", {
      method: "POST",
      body: JSON.stringify({
        newPassword: $("newPassword").value,
        confirmPassword: $("confirmPassword").value
      })
    });
    state.user = data.user;
    $("userName").textContent = state.user.name;
    $("userRole").textContent = state.user.role;
    hidePasswordModal();
    alert("Senha alterada com sucesso.");
  } catch (error) {
    $("passwordError").textContent = error.message;
  }
}

async function boot() {
  if (location.protocol === "file:") return showFileModeMessage();
  try {
    const data = await api("/api/bootstrap");
    Object.assign(state, data);
    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    $("userName").textContent = state.user.name;
    $("userRole").textContent = state.user.role;
    buildNav();
    renderAll(data.nextCode);
    addItem();
    if ($("proposalDate")) $("proposalDate").valueAsDate = new Date();
    if ($("entryDate")) $("entryDate").valueAsDate = new Date();
    showPage(can("dashboard") ? "dashboard" : state.user.permissions[0]);
    if (state.user.mustChangePassword) showPasswordModal();
  } catch {
    $("loginView").classList.remove("hidden");
  }
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (location.protocol === "file:") return showFileModeMessage();
  $("loginError").textContent = "";
  try {
    await api("/api/login", { method: "POST", body: JSON.stringify({ email: $("loginEmail").value.trim(), password: $("loginPassword").value }) });
    await boot();
  } catch (error) {
    $("loginError").textContent = error.message;
  }
});

$("logoutBtn").addEventListener("click", async () => { await api("/api/logout", { method: "POST" }); location.reload(); });
if ($("addItemBtn")) $("addItemBtn").addEventListener("click", () => addItem());
if ($("saveProposalBtn")) $("saveProposalBtn").addEventListener("click", () => saveProposal({ openPdf: false }));
if ($("orderTopBtn")) $("orderTopBtn").addEventListener("click", () => state.editingProposalId ? markProposalAsOrder(state.editingProposalId) : saveProposal({ markOrder: true }));
if ($("pdfTopBtn")) $("pdfTopBtn").addEventListener("click", () => saveProposal({ openPdf: true }));
if ($("pdfBottomBtn")) $("pdfBottomBtn").addEventListener("click", () => saveProposal({ openPdf: true }));
if ($("createUserBtn")) $("createUserBtn").addEventListener("click", createUser);
if ($("createCommissionUserBtn")) $("createCommissionUserBtn").addEventListener("click", createCommissionUser);
if ($("downloadBackupBtn")) $("downloadBackupBtn").addEventListener("click", downloadBackup);
if ($("restoreBackupInput")) $("restoreBackupInput").addEventListener("change", (event) => restoreBackup(event.target.files[0]));
if ($("refreshActivityBtn")) $("refreshActivityBtn").addEventListener("click", refreshActivity);
if ($("attachmentInput")) $("attachmentInput").addEventListener("change", (event) => addAttachments(event.target.files));
if ($("passwordForm")) $("passwordForm").addEventListener("submit", changePassword);
[
  ["customerDocument", maskCpfCnpj],
  ["customerZip", maskCep],
  ["customerPhone", maskPhone]
].forEach(([id, mask]) => {
  if ($(id)) $(id).addEventListener("input", () => { $(id).value = mask($(id).value); });
});
["proposalDate", "payment", "financeEntry", "entryDate", "financeInterest", "financeInstallments", "discountPct", "marginPct", "saleModel", "freightEnabled", "freightValue"].forEach((id) => {
  if ($(id)) $(id).addEventListener("input", calculateTotals);
  if ($(id)) $(id).addEventListener("change", calculateTotals);
});
document.querySelectorAll("[data-page-jump]").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.pageJump)));

boot();
