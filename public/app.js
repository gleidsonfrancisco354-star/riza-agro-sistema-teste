const state = { user: null, products: [], proposals: [], users: [], clients: [], permissions: [], activityLogs: [], attachments: [] };
const $ = (id) => document.getElementById(id);
const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const brl = (value) => round2(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
      ["Coordenador Regional", 2.50, true, 1.00],
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
  ["users", "CONFIGURACOES", "settings"]
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
  return `${cleanText(product.linha)} | ${cleanText(product.produto)} | ${cleanText(product.tecnologia)}`;
}

function uniqueValues(items, field) {
  return [...new Set(items.map((item) => item[field]).filter(Boolean))];
}

function cleanText(value) {
  return String(value || "")
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
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢|Ã¢â‚¬Â¢/g, "-")
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

function paymentHorizonMonths() {
  const count = Math.max(0, Math.floor(Number($("financeInstallments")?.value || 0)));
  return count;
}

function priceForMonths(product, months) {
  const cleanMonths = Math.max(0, Math.floor(Number(months || 0)));
  const index = prazoIndexFromMonths(cleanMonths);
  if (Array.isArray(product?.prazos) && product.prazos[index] !== undefined) {
    const listed = Number(product.prazos[index]);
    if (cleanMonths <= 6) return round2(listed);
    const monthlyInterest = Number($("financeInterest")?.value || 2) / 100;
    return round2(listed * Math.pow(1 + monthlyInterest, cleanMonths - 6));
  }
  const monthlyInterest = Number($("financeInterest")?.value || 2) / 100;
  return round2(Number(product?.preco || 0) * Math.pow(1 + monthlyInterest, index));
}

function paymentHorizonDays() {
  return paymentHorizonMonths() * 30;
}

function getCommissionPolicy() {
  return commissionPolicies[$("saleModel")?.value] || commissionPolicies.revenda;
}

function applySaleModelRules() {
  const policy = getCommissionPolicy();
  const maxDiscount = Number(policy.maxDiscount || 0);
  const autoDiscount = Number(policy.autoItemDiscount || 0);
  if ($("discountPct")) {
    $("discountPct").max = String(maxDiscount);
    if (autoDiscount > 0) {
      $("discountPct").value = "0";
      $("discountPct").disabled = true;
    } else {
      $("discountPct").disabled = false;
      if (Number($("discountPct").value || 0) > maxDiscount) $("discountPct").value = String(maxDiscount);
    }
  }
  $("itemsBody")?.querySelectorAll(".itemDiscountInput").forEach((input) => {
    input.max = String(maxDiscount);
    if (autoDiscount > 0) {
      input.value = autoDiscount.toFixed(2);
      input.readOnly = true;
      input.dataset.autoDiscount = "true";
      input.title = "Revenda aplica desconto automatico de 10%.";
    } else {
      if (input.dataset.autoDiscount === "true") input.value = "0";
      delete input.dataset.autoDiscount;
      input.readOnly = false;
      input.title = `Desconto maximo deste canal: ${maxDiscount}%`;
      if (Number(input.value || 0) > maxDiscount) input.value = String(maxDiscount);
    }
  });
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
    return `<tr><td>${cleanText(product.linha)} | ${cleanText(product.produto)}</td><td>${cleanText(product.tecnologia)}</td><td>${cleanText(product.apresentacao)}</td><td class="moneyCell">${brl(product.preco)}</td><td><button class="addMiniBtn" data-add-product="${index}">Incluir</button></td></tr>`;
  }).join("");
  $(target).querySelectorAll("[data-add-product]").forEach((button) => button.addEventListener("click", () => addItem(state.products[Number(button.dataset.addProduct)])));
}

function addItem(product = state.products[0]) {
  if (!product) return;
  const tr = document.createElement("tr");
  const lineOptions = uniqueValues(state.products, "linha").map((line) => `<option value="${line}">${cleanText(line)}</option>`).join("");
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
    const itemDiscountPct = Number(tr.querySelector(".itemDiscountInput")?.value || 0);
    const grossLine = round2(qty * unitPrice);
    const cashGrossLine = round2(qty * cashUnitPrice);
    const itemDiscount = round2(grossLine * itemDiscountPct / 100);
    const cashItemDiscount = round2(cashGrossLine * itemDiscountPct / 100);
    const line = round2(Math.max(0, grossLine - itemDiscount));
    tr.querySelector(".totalCell").textContent = brl(line);
    tr.querySelector(".totalCell").dataset.total = String(line);
    itemCount += qty;
    grossTotal += grossLine;
    cashGrossTotal += cashGrossLine;
    itemDiscountTotal += itemDiscount;
    cashItemDiscountTotal += cashItemDiscount;
  });
  const policy = getCommissionPolicy();
  const maxDiscount = Number(policy.maxDiscount || 0);
  const discountPct = Math.min(Math.max(0, Number($("discountPct")?.value || 0)), maxDiscount);
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
      <div class="userEditGrid">
        <label>Nome<input class="editUserName" value="${user.name || ""}"></label>
        <label>E-mail<input class="editUserEmail" value="${user.email || ""}"></label>
        <label>Perfil<input class="editUserRole" value="${user.role || "Consultor"}"></label>
        <label>Nova senha<input class="editUserPassword" placeholder="Manter senha atual"></label>
        <label class="check statusCheck"><input class="editUserActive" type="checkbox" ${user.active ? "checked" : ""}>Usuario ativo</label>
      </div>
      <div class="permGrid">${permissionCheckboxes(user.permissions || [])}</div>
      <div class="rowActions"><button class="secondaryBtn savePermBtn">Salvar usuario</button><button class="dangerTiny deleteUserBtn">Excluir usuario</button></div>
    </div>`).join("");
  document.querySelectorAll(".userCard").forEach((card) => {
    card.querySelector(".savePermBtn").addEventListener("click", async () => {
      const permissions = [...card.querySelectorAll(".permGrid input:checked")].map((input) => input.value);
      const payload = {
        name: card.querySelector(".editUserName").value.trim(),
        email: card.querySelector(".editUserEmail").value.trim(),
        role: card.querySelector(".editUserRole").value.trim(),
        active: card.querySelector(".editUserActive").checked,
        permissions
      };
      const password = card.querySelector(".editUserPassword").value;
      if (password) payload.password = password;
      const data = await api(`/api/users/${card.dataset.user}`, { method: "PATCH", body: JSON.stringify(payload) });
      state.users = data.users;
      renderUsers();
      refreshActivity();
    });
    card.querySelector(".deleteUserBtn").addEventListener("click", async () => {
      if (!confirm("Excluir este usuario?")) return;
      const data = await api(`/api/users/${card.dataset.user}`, { method: "DELETE" });
      state.users = data.users;
      renderUsers();
      refreshActivity();
    });
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
  state.attachments = [];
  renderAttachments();
  $("itemsBody").innerHTML = "";
  addItem();
}

async function saveProposal(options = {}) {
  const shouldOpenPdf = !!options.openPdf;
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
    const data = await api("/api/proposals", { method: "POST", body: JSON.stringify(payload) });
    state.proposals.unshift(data.proposal);
    renderAll(data.nextCode);
    clearProposal();
    showPage("history");
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
    refreshActivity();
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
  const freight = $("freightEnabled")?.checked ? round2(Math.max(0, Number($("freightValue")?.value || 0))) : 0;
  return {
    discountPct: Number($("discountPct")?.value || 0),
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
    amount: row.querySelector(".installmentAmountInput")?.value || ""
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
    const value = previous[index]?.amount || adjustedLast.toFixed(2);
    return `<tr class="installmentRow">
      <td>Parcela ${index + 1}</td>
      <td><input class="installmentDateInput" type="date" value="${isoDate}"></td>
      <td><input class="installmentAmountInput" type="number" min="0" step="0.01" value="${value}"></td>
    </tr>`;
  }).join("");
  $("installmentsBox").innerHTML = `<h3>Cronograma de parcelas</h3><table><thead><tr><th>Parcela</th><th>Data</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>`;
  $("installmentsBox").querySelectorAll(".installmentDateInput,.installmentAmountInput").forEach((input) => input.addEventListener("change", calculateTotals));
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
  renderStats(nextCode);
  renderProducts();
  renderHistory();
  renderClients();
  renderReports();
  renderUsers();
  renderActivity();
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
if ($("pdfTopBtn")) $("pdfTopBtn").addEventListener("click", () => saveProposal({ openPdf: true }));
if ($("pdfBottomBtn")) $("pdfBottomBtn").addEventListener("click", () => saveProposal({ openPdf: true }));
if ($("createUserBtn")) $("createUserBtn").addEventListener("click", createUser);
if ($("refreshActivityBtn")) $("refreshActivityBtn").addEventListener("click", refreshActivity);
if ($("attachmentInput")) $("attachmentInput").addEventListener("change", (event) => addAttachments(event.target.files));
[
  ["customerDocument", maskCpfCnpj],
  ["customerZip", maskCep],
  ["customerPhone", maskPhone]
].forEach(([id, mask]) => {
  if ($(id)) $(id).addEventListener("input", () => { $(id).value = mask($(id).value); });
});
["payment", "financeEntry", "entryDate", "financeInterest", "financeInstallments", "discountPct", "marginPct", "saleModel", "freightEnabled", "freightValue"].forEach((id) => {
  if ($(id)) $(id).addEventListener("input", calculateTotals);
  if ($(id)) $(id).addEventListener("change", calculateTotals);
});
document.querySelectorAll("[data-page-jump]").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.pageJump)));

boot();
