const state = { user: null, products: [], proposals: [], users: [], clients: [], permissions: [], attachments: [] };
const $ = (id) => document.getElementById(id);
const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const commissionPolicies = {
  representante: {
    label: "Representante Comercial",
    subtitle: "Cliente Final / Revendas",
    rows: [
      ["Representante Comercial", 10.00, true],
      ["Coordenador Regional", 2.50, true],
      ["Gerente Nacional de Vendas", 1.00, false],
      ["Retaguarda Comercial", 0.10, false],
      ["Gerente de Planejamento", 0.25, false],
      ["Diretor Comercial", 0.33, false]
    ]
  },
  rtv: {
    label: "RTV",
    subtitle: "Representante Tecnico de Vendas",
    rows: [
      ["Representante Tecnico de Vendas", 3.00, true],
      ["Coordenador Regional", 2.50, true],
      ["Gerente Nacional de Vendas", 1.00, false],
      ["Retaguarda Comercial", 0.10, false],
      ["Gerente de Planejamento", 0.25, false],
      ["Diretor Comercial", 0.33, false]
    ]
  },
  sem_rep_rtv: {
    label: "Sem RTV / Representante",
    subtitle: "Operacao interna",
    rows: [
      ["Coordenador Regional", 5.00, true],
      ["Gerente Nacional de Vendas", 1.00, false],
      ["Retaguarda Comercial", 0.10, false],
      ["Gerente de Planejamento", 0.25, false],
      ["Diretor Comercial", 0.33, false]
    ]
  },
  vendas_diretas: {
    label: "Vendas Diretas",
    subtitle: "Canal estrategico",
    rows: [
      ["Coordenador Regional", 1.00, true],
      ["Gerente Nacional de Vendas", 0.33, false],
      ["Retaguarda Comercial", 0.10, false],
      ["Gerente de Planejamento", 0.25, false],
      ["Diretor Comercial", 0.33, false]
    ]
  }
};

const modules = [
  ["dashboard", "DASHBOARD", "âŒ‚"],
  ["proposal", "PROPOSTA COMERCIAL", "â–¤"],
  ["rizaPlus", "RIZA+", "+"],
  ["virtus", "RIZA VIRTUS", "â˜˜"],
  ["finance", "SIMULADOR FINANCEIRO", "â–¦"],
  ["clients", "CLIENTES", "â™Ÿ"],
  ["products", "PRODUTOS", "â– "],
  ["history", "HISTORICO", "â†»"],
  ["reports", "RELATORIOS", "â–¥"],
  ["users", "CONFIGURACOES", "âš™"]
];

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
  return `${product.linha} | ${product.produto} | ${product.tecnologia}`;
}

function uniqueValues(items, field) {
  return [...new Set(items.map((item) => item[field]).filter(Boolean))];
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

function prazoIndex(days) {
  const value = Number(days || 0);
  if (value <= 7) return 0;
  if (value <= 30) return 1;
  if (value <= 60) return 2;
  if (value <= 90) return 3;
  if (value <= 120) return 4;
  if (value <= 150) return 5;
  return 6;
}

function priceForDays(product, days) {
  const index = prazoIndex(days);
  if (Array.isArray(product?.prazos) && product.prazos[index] !== undefined) return Number(product.prazos[index]);
  const monthlyInterest = Number($("financeInterest")?.value || 2) / 100;
  return Number(product?.preco || 0) * Math.pow(1 + monthlyInterest, index);
}

function paymentHorizonDays() {
  const today = new Date();
  const entryDate = $("entryDate")?.value ? new Date(`${$("entryDate").value}T00:00:00`) : null;
  const entryDays = entryDate ? Math.max(0, Math.round((entryDate - today) / 86400000)) : 0;
  const parcelDays = [...document.querySelectorAll(".installmentDateInput")]
    .map((input) => input.value ? Math.max(0, Math.round((new Date(`${input.value}T00:00:00`) - today) / 86400000)) : 0);
  if (parcelDays.length) return Math.max(entryDays, ...parcelDays);
  const count = Number($("financeInstallments")?.value || 0);
  return Math.max(entryDays, count > 0 ? count * 30 : 0);
}

function updateItemPricesForPayment() {
  const days = paymentHorizonDays();
  $("itemsBody")?.querySelectorAll("tr").forEach((tr) => {
    const selected = state.products[Number(tr.dataset.productIndex)] || findProduct(
      tr.querySelector(".lineSelect").value,
      tr.querySelector(".cultivarSelect").value,
      tr.querySelector(".standardSelect").value
    );
    tr.querySelector(".priceInput").value = priceForDays(selected, days).toFixed(2);
  });
}

function showFileModeMessage() {
  $("fileModeHelp").classList.remove("hidden");
  $("loginError").textContent = "Abra pelo ABRIR_SISTEMA_RIZA.bat ou pelo endereco http://localhost:8787/";
}

function buildNav() {
  $("navList").innerHTML = modules.filter(([id]) => can(id)).map(([id, label, icon]) => (
    `<button class="navBtn ${id === "dashboard" ? "active" : ""}" data-page="${id}"><span>${icon}</span>${label}</button>`
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

function renderProducts() {
  $("productsBody").innerHTML = state.products.map((product) => `
    <tr><td>${product.linha}</td><td><b>${product.produto}</b></td><td>${product.tecnologia}</td><td>${product.apresentacao}</td><td class="moneyCell">${brl(product.preco)}</td></tr>`
  ).join("");
  renderProductCards("rizaPlusGrid", state.products.filter((product) => product.linha === "RIZA+"));
  renderProductCards("virtusGrid", state.products.filter((product) => product.linha === "RIZA VIRTUS"));
  renderMiniProducts("rizaPlusMini", state.products.filter((product) => product.linha === "RIZA+").slice(0, 5));
  renderMiniProducts("virtusMini", state.products.filter((product) => product.linha === "RIZA VIRTUS").slice(0, 5));
}

function renderProductCards(target, products) {
  if (!$(target)) return;
  $(target).innerHTML = products.map((product) => `
    <div class="productCard"><small>${product.linha}</small><b>${product.produto}</b><span>${product.tecnologia} â€¢ ${product.apresentacao}</span><strong>${brl(product.preco)}</strong></div>`
  ).join("");
}

function renderMiniProducts(target, products) {
  if (!$(target)) return;
  $(target).innerHTML = products.map((product) => {
    const index = state.products.indexOf(product);
    return `<tr><td>${product.linha} | ${product.produto}</td><td>${product.tecnologia}</td><td>${product.apresentacao}</td><td class="moneyCell">${brl(product.preco)}</td><td><button class="addMiniBtn" data-add-product="${index}">+</button></td></tr>`;
  }).join("");
  $(target).querySelectorAll("[data-add-product]").forEach((button) => button.addEventListener("click", () => addItem(state.products[Number(button.dataset.addProduct)])));
}

function addItem(product = state.products[0]) {
  if (!product) return;
  const tr = document.createElement("tr");
  const lineOptions = uniqueValues(state.products, "linha").map((line) => `<option value="${line}">${line}</option>`).join("");
  tr.innerHTML = `
    <td><select class="lineSelect">${lineOptions}</select></td>
    <td><select class="cultivarSelect"></select></td>
    <td><select class="standardSelect"></select></td>
    <td><input class="packageInput" value="${product.apresentacao || ""}"></td>
    <td><input class="quantityInput" type="number" min="0" step="1" value="1"></td>
    <td>UN</td>
    <td><input class="priceInput" type="number" min="0" step="0.01" value="${product.preco || 0}"></td>
    <td><input class="itemDiscountInput" type="number" min="0" max="100" step="0.01" value="0"></td>
    <td class="totalCell">R$ 0,00</td>
    <td><button type="button" class="removeBtn">Remover</button></td>`;
  const lineSelect = tr.querySelector(".lineSelect");
  const cultivarSelect = tr.querySelector(".cultivarSelect");
  const standardSelect = tr.querySelector(".standardSelect");

  function fillCultivars(preferredCultivar) {
    const cultivars = uniqueValues(state.products.filter((item) => item.linha === lineSelect.value), "produto");
    cultivarSelect.innerHTML = cultivars.map((cultivar) => `<option value="${cultivar}">${cultivar}</option>`).join("");
    if (preferredCultivar && cultivars.includes(preferredCultivar)) cultivarSelect.value = preferredCultivar;
  }

  function fillStandards(preferredStandard) {
    const standards = uniqueValues(state.products.filter((item) => item.linha === lineSelect.value && item.produto === cultivarSelect.value), "tecnologia");
    standardSelect.innerHTML = standards.map((standard) => `<option value="${standard}">${standard}</option>`).join("");
    if (preferredStandard && standards.map(String).includes(String(preferredStandard))) standardSelect.value = preferredStandard;
  }

  function syncProduct() {
    const selected = findProduct(lineSelect.value, cultivarSelect.value, standardSelect.value);
    tr.dataset.productIndex = String(state.products.indexOf(selected));
    tr.querySelector(".packageInput").value = selected.apresentacao || "";
    tr.querySelector(".priceInput").value = priceForDays(selected, paymentHorizonDays()).toFixed(2);
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
    const discountPct = Number(tr.querySelector(".itemDiscountInput")?.value || 0);
    const grossTotal = quantity * unitPrice;
    const grossCashTotal = quantity * cashUnitPrice;
    return {
      line: selected.linha,
      product: selected.produto,
      standard: tr.querySelector(".standardSelect").value,
      package: tr.querySelector(".packageInput").value,
      quantity,
      unitPrice,
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
    const itemDiscountPct = Number(tr.querySelector(".itemDiscountInput")?.value || 0);
    const grossLine = qty * unitPrice;
    const cashGrossLine = qty * cashUnitPrice;
    const itemDiscount = grossLine * itemDiscountPct / 100;
    const cashItemDiscount = cashGrossLine * itemDiscountPct / 100;
    const line = Math.max(0, grossLine - itemDiscount);
    tr.querySelector(".totalCell").textContent = brl(line);
    tr.querySelector(".totalCell").dataset.total = String(line);
    itemCount += qty;
    grossTotal += grossLine;
    cashGrossTotal += cashGrossLine;
    itemDiscountTotal += itemDiscount;
    cashItemDiscountTotal += cashItemDiscount;
  });
  const discountPct = Number($("discountPct")?.value || 0);
  const afterItemDiscount = Math.max(0, grossTotal - itemDiscountTotal);
  const cashAfterItemDiscount = Math.max(0, cashGrossTotal - cashItemDiscountTotal);
  const globalDiscountValue = afterItemDiscount * discountPct / 100;
  const cashGlobalDiscountValue = cashAfterItemDiscount * discountPct / 100;
  const discountValue = itemDiscountTotal + globalDiscountValue;
  const cashDiscountValue = cashItemDiscountTotal + cashGlobalDiscountValue;
  const finalTotal = Math.max(0, grossTotal - discountValue);
  const cashFinalTotal = Math.max(0, cashGrossTotal - cashDiscountValue);
  const totalDiscountPct = grossTotal > 0 ? discountValue / grossTotal * 100 : 0;
  const commissionPct = getCommissionTotals(totalDiscountPct).finalPct / 100;
  const commission = finalTotal * commissionPct;
  state.currentTotals = { grossTotal, cashGrossTotal, discountValue, cashDiscountValue, finalTotal, cashFinalTotal, totalDiscountPct, horizonDays: paymentHorizonDays() };
  const pairs = [["proposalTotal", finalTotal], ["kpiGross", cashGrossTotal], ["kpiDiscount", discountValue], ["kpiFinal", finalTotal], ["kpiCommission", commission], ["financeGross", cashGrossTotal], ["financeDiscount", discountValue], ["financeFinal", finalTotal]];
  pairs.forEach(([id, value]) => { if ($(id)) $(id).textContent = brl(value); });
  if ($("kpiItems")) $("kpiItems").textContent = `${itemCount} itens`;
  if ($("kpiFinalItems")) $("kpiFinalItems").textContent = `${itemCount} itens`;
  const discountLabel = $("kpiDiscount")?.nextElementSibling;
  if (discountLabel) discountLabel.textContent = `${discountPct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  if ($("directorSummary")) {
    $("directorSummary").innerHTML = `
      <div class="summaryRow"><span>Modelo</span><b>${getCommissionPolicy().label}</b></div>
      <div class="summaryRow"><span>Total sem juros</span><b>${brl(cashFinalTotal)}</b></div>
      <div class="summaryRow"><span>Desconto</span><b>${brl(discountValue)}</b></div>
      <div class="summaryRow final"><span>Total final negociado</span><b>${brl(finalTotal)}</b></div>
      <div class="summaryRow"><span>Comissao Final</span><b>${brl(commission)}</b></div>
      <div class="summaryRow"><span>Margem</span><b>${Number($("marginPct")?.value || 15).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</b></div>`;
  }
  calcFinance(finalTotal);
  renderCommission(finalTotal, grossTotal, totalDiscountPct);
}

function renderHistory() {
  $("historyBody").innerHTML = state.proposals.map((proposal) => `
    <tr>
      <td><b>${proposal.code}</b></td><td>${proposal.customer.name}<br><small>${proposal.customer.company || ""}</small></td>
      <td class="moneyCell">${brl(proposal.total)}</td><td>${proposal.createdByName}</td><td>${proposal.createdAtLabel}</td>
      <td><div class="rowActions"><button class="secondaryBtn" data-pdf="${proposal.id}">PDF</button><button class="dangerTiny" data-delete-proposal="${proposal.id}">Excluir</button></div></td>
    </tr>`).join("");
  $("emptyHistory").style.display = state.proposals.length ? "none" : "block";
  document.querySelectorAll("[data-pdf]").forEach((button) => button.addEventListener("click", () => window.open(`/api/proposals/${button.dataset.pdf}/pdf`, "_blank")));
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
  const total = state.proposals.reduce((sum, proposal) => sum + Number(proposal.total || 0), 0);
  const items = state.proposals.reduce((sum, proposal) => sum + proposal.items.length, 0);
  $("reportsGrid").innerHTML = `
    <div class="infoCard"><small>Total emitido</small><b>${brl(total)}</b></div>
    <div class="infoCard"><small>Propostas</small><b>${state.proposals.length}</b></div>
    <div class="infoCard"><small>Itens negociados</small><b>${items}</b></div>
    <div class="infoCard"><small>Produtos cadastrados</small><b>${state.products.length}</b></div>`;
}

function permissionCheckboxes(selected = []) {
  return modules.map(([id, label]) => `
    <label class="check"><input type="checkbox" value="${id}" ${selected.includes(id) ? "checked" : ""}>${label}</label>`
  ).join("");
}

function renderUsers() {
  if (!can("users")) return;
  $("newUserPerms").innerHTML = permissionCheckboxes(["dashboard", "proposal", "history"]);
  $("usersList").innerHTML = state.users.map((user) => `
    <div class="userCard" data-user="${user.id}">
      <div><b>${user.name}</b><span>${user.email}</span><small>${user.role} â€¢ ${user.active ? "Ativo" : "Inativo"}</small></div>
      <div class="permGrid">${permissionCheckboxes(user.permissions || [])}</div>
      <div class="rowActions"><button class="secondaryBtn savePermBtn">Salvar permissoes</button><button class="dangerTiny deleteUserBtn">Excluir usuario</button></div>
    </div>`).join("");
  document.querySelectorAll(".userCard").forEach((card) => {
    card.querySelector(".savePermBtn").addEventListener("click", async () => {
      const permissions = [...card.querySelectorAll("input:checked")].map((input) => input.value);
      const data = await api(`/api/users/${card.dataset.user}`, { method: "PATCH", body: JSON.stringify({ permissions }) });
      state.users = data.users;
      renderUsers();
    });
    card.querySelector(".deleteUserBtn").addEventListener("click", async () => {
      if (!confirm("Excluir este usuario?")) return;
      const data = await api(`/api/users/${card.dataset.user}`, { method: "DELETE" });
      state.users = data.users;
      renderUsers();
    });
  });
}

function clearProposal() {
  ["customerName", "customerCompany", "customerDocument", "customerStateRegistration", "customerAddress", "customerZip", "customerPhone", "customerEmail", "customerCity"].forEach((id) => { if ($(id)) $(id).value = ""; });
  state.attachments = [];
  renderAttachments();
  $("itemsBody").innerHTML = "";
  addItem();
}

async function saveProposal() {
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
    const data = await api("/api/proposals", { method: "POST", body: JSON.stringify(payload) });
    state.proposals.unshift(data.proposal);
    renderAll(data.nextCode);
    clearProposal();
    showPage("history");
    window.open(`/api/proposals/${data.proposal.id}/pdf`, "_blank");
  } catch (error) {
    $("formError").textContent = error.message;
  }
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
        permissions
      })
    });
    state.users = data.users;
    renderStats();
    renderUsers();
  } catch (error) {
    $("userError").textContent = error.message;
  }
}

async function deleteProposal(id) {
  if (!confirm("Excluir esta proposta do historico?")) return;
  const data = await api(`/api/proposals/${id}`, { method: "DELETE" });
  state.proposals = data.proposals;
  renderAll();
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
  return {
    discountPct: Number($("discountPct")?.value || 0),
    entryPct: Number($("financeEntry")?.value || 0),
    entryDate: $("entryDate")?.value || "",
    interestPct: Number($("financeInterest")?.value || 0),
    installments: Number($("financeInstallments")?.value || 0),
    paymentHorizonDays: paymentHorizonDays(),
    totalWithoutInterest: state.currentTotals?.cashFinalTotal || 0,
    totalWithInterest: state.currentTotals?.finalTotal || 0,
    commissionBasePct: Number($("commissionBase")?.value || 14.18),
    commissionFinalPct: Number($("commissionFinal")?.value || 14.18),
    marginPct: Number($("marginPct")?.value || 15),
    saleModel: $("saleModel")?.value || "representante",
    saleModelLabel: getCommissionPolicy().label,
    installmentSchedule: [...document.querySelectorAll(".installmentRow")].map((row, index) => ({
      label: `${index + 1}Âª parcela`,
      date: row.querySelector(".installmentDateInput")?.value || "",
      amount: Number(row.querySelector(".installmentAmountInput")?.value || 0)
    }))
  };
}

function calcFinance(finalTotal = null) {
  if (!$("financeResult")) return;
  const base = finalTotal ?? currentProposalTotal();
  const entryPct = Number($("financeEntry")?.value || 0);
  const rawInstallments = Number($("financeInstallments")?.value || 0);
  const entry = base * entryPct / 100;
  const parcelTotal = Math.max(0, base - entry);
  const cashTotal = state.currentTotals?.cashFinalTotal || base;
  if ($("entryDateLabel")) $("entryDateLabel").classList.toggle("hidden", entryPct <= 0);
  $("financeResult").innerHTML = `<b>Total sem juros<br>${brl(cashTotal)}</b><b>Entrada<br>${brl(entry)}</b><b>Valor parcelado<br>${brl(parcelTotal)}</b>`;
  renderInstallments(parcelTotal, rawInstallments);
}

function renderInstallments(amount, count) {
  if (!$("installmentsBox")) return;
  const previous = [...document.querySelectorAll(".installmentRow")].map((row) => ({
    date: row.querySelector(".installmentDateInput")?.value || "",
    amount: row.querySelector(".installmentAmountInput")?.value || ""
  }));
  if (!count || count <= 0) {
    $("installmentsBox").innerHTML = `<div class="emptyState compact">Informe o numero de parcelas para gerar as datas.</div>`;
    return;
  }
  const baseDate = $("entryDate")?.value ? new Date(`${$("entryDate").value}T00:00:00`) : new Date();
  const defaultAmount = count > 0 ? amount / count : 0;
  const rows = Array.from({ length: count }, (_, index) => {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + index + 1);
    const isoDate = previous[index]?.date || date.toISOString().slice(0, 10);
    const value = previous[index]?.amount || defaultAmount.toFixed(2);
    return `<tr class="installmentRow">
      <td>${index + 1}Âª parcela</td>
      <td><input class="installmentDateInput" type="date" value="${isoDate}"></td>
      <td><input class="installmentAmountInput" type="number" min="0" step="0.01" value="${value}"></td>
    </tr>`;
  }).join("");
  $("installmentsBox").innerHTML = `<h3>Cronograma de parcelas</h3><table><thead><tr><th>Parcela</th><th>Data</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>`;
  $("installmentsBox").querySelectorAll(".installmentDateInput,.installmentAmountInput").forEach((input) => input.addEventListener("change", calculateTotals));
}

function getCommissionPolicy() {
  return commissionPolicies[$("saleModel")?.value] || commissionPolicies.representante;
}

function getCommissionTotals(discountPct = 0) {
  const policy = getCommissionPolicy();
  const basePct = policy.rows.reduce((sum, row) => sum + row[1], 0);
  const negotiablePct = policy.rows.filter((row) => row[2]).reduce((sum, row) => sum + row[1], 0);
  const discountOnCommission = Math.min(Math.max(0, discountPct), negotiablePct);
  const finalPct = policy.rows.reduce((sum, row) => {
    if (!row[2] || negotiablePct <= 0) return sum + row[1];
    return sum + Math.max(0, row[1] - discountOnCommission * (row[1] / negotiablePct));
  }, 0);
  return { policy, basePct, finalPct, discountOnCommission, negotiablePct };
}

function renderCommission(finalTotal, grossTotal = finalTotal, discountPct = 0) {
  const { policy, basePct, finalPct, discountOnCommission, negotiablePct } = getCommissionTotals(discountPct);
  if ($("commissionChannel")) $("commissionChannel").innerHTML = `${policy.label}<br><small>${policy.subtitle}</small>`;
  if ($("commissionBaseBox")) $("commissionBaseBox").textContent = `${basePct.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`;
  if ($("commissionFinalBox")) $("commissionFinalBox").textContent = `${finalPct.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`;
  if ($("commissionBase")) $("commissionBase").value = basePct.toFixed(2);
  if ($("commissionFinal")) $("commissionFinal").value = finalPct.toFixed(2);
  if (!$("commissionRows")) return;
  $("commissionRows").innerHTML = policy.rows.map(([name, pct, negotiable]) => {
    const finalRowPct = negotiable && negotiablePct > 0
      ? Math.max(0, pct - discountOnCommission * (pct / negotiablePct))
      : pct;
    return `<tr><td>${name}</td><td>${pct.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</td><td>${finalRowPct.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</td><td class="moneyCell">${brl(grossTotal * finalRowPct / 100)}</td></tr>`;
  }).join("");
}

function renderAll(nextCode) {
  renderStats(nextCode);
  renderProducts();
  renderHistory();
  renderClients();
  renderReports();
  renderUsers();
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
    if ($("firstInstallmentDate")) $("firstInstallmentDate").valueAsDate = new Date();
    showPage(can("dashboard") ? "dashboard" : state.user.permissions[0]);
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
if ($("saveProposalBtn")) $("saveProposalBtn").addEventListener("click", saveProposal);
if ($("pdfTopBtn")) $("pdfTopBtn").addEventListener("click", saveProposal);
if ($("pdfBottomBtn")) $("pdfBottomBtn").addEventListener("click", saveProposal);
if ($("createUserBtn")) $("createUserBtn").addEventListener("click", createUser);
if ($("attachmentInput")) $("attachmentInput").addEventListener("change", (event) => addAttachments(event.target.files));
[
  ["customerDocument", maskCpfCnpj],
  ["customerZip", maskCep],
  ["customerPhone", maskPhone]
].forEach(([id, mask]) => {
  if ($(id)) $(id).addEventListener("input", () => { $(id).value = mask($(id).value); });
});
["payment", "financeEntry", "entryDate", "financeInterest", "financeInstallments", "discountPct", "marginPct", "saleModel"].forEach((id) => {
  if ($(id)) $(id).addEventListener("input", calculateTotals);
  if ($(id)) $(id).addEventListener("change", calculateTotals);
});
document.querySelectorAll("[data-page-jump]").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.pageJump)));

boot();
