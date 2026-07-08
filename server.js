const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const publicDir = path.join(root, "public");
const dbPath = path.join(root, "data", "db.json");
const productsPath = path.join(root, "data", "products.json");
const sessions = new Map();
const allPermissions = ["dashboard", "proposal", "rizaPlus", "virtus", "finance", "clients", "products", "history", "reports", "users"];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8"
};

function readDb() {
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
}

function readProducts() {
  return JSON.parse(fs.readFileSync(productsPath, "utf8").replace(/^\uFEFF/, ""));
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active !== false,
    permissions: user.permissions || []
  };
}

function can(user, permission) {
  return user && Array.isArray(user.permissions) && user.permissions.includes(permission);
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  if (Buffer.isBuffer(body) || typeof body === "string") {
    res.end(body);
    return;
  }
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((cookie) => {
    const [key, ...value] = cookie.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }));
}

function currentUser(req) {
  const token = parseCookies(req).riza_session;
  if (!token || !sessions.has(token)) return null;
  return sessions.get(token);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 15_000_000) {
        req.destroy();
        reject(new Error("Payload muito grande."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON invalido."));
      }
    });
  });
}

function proposalCode(number) {
  return `RZ-${String(number).padStart(5, "0")}`;
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function money(value) {
  return round2(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
  }
  return value;
}

function logoDataUri() {
  const logoPath = path.join(publicDir, "assets", "logo-riza-agro.jpeg");
  if (!fs.existsSync(logoPath)) return "";
  return `data:image/jpeg;base64,${fs.readFileSync(logoPath).toString("base64")}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function pdfHtml(proposal) {
  const logo = logoDataUri();
  const financial = proposal.financial || {};
  const discountPct = Number(financial.discountPct || 0);
  const gross = proposal.items.reduce((sum, item) => sum + Number(item.grossTotal ?? (Number(item.quantity || 0) * Number(item.unitPrice || 0))), 0);
  const cashGross = proposal.items.reduce((sum, item) => sum + Number(item.grossCashTotal ?? (Number(item.quantity || 0) * Number(item.cashUnitPrice || item.unitPrice || 0))), 0);
  const itemDiscount = proposal.items.reduce((sum, item) => sum + (Number(item.grossTotal ?? (Number(item.quantity || 0) * Number(item.unitPrice || 0))) - Number(item.total || 0)), 0);
  const cashItemDiscount = proposal.items.reduce((sum, item) => sum + (Number(item.grossCashTotal ?? (Number(item.quantity || 0) * Number(item.cashUnitPrice || item.unitPrice || 0))) - Number(item.cashTotal || item.total || 0)), 0);
  const freight = financial.freightEnabled ? round2(Number(financial.freightValue || proposal.freight || 0)) : round2(Number(proposal.freight || 0));
  const discount = round2(itemDiscount + Math.max(0, gross - itemDiscount) * discountPct / 100);
  const cashDiscount = round2(cashItemDiscount + Math.max(0, cashGross - cashItemDiscount) * discountPct / 100);
  const finalTotalNoFreight = round2(Math.max(0, gross - discount));
  const finalTotal = round2(finalTotalNoFreight + freight);
  const finalCashNoFreight = round2(Math.max(0, cashGross - cashDiscount));
  const finalCashTotal = round2(Number(proposal.totalWithoutInterest ?? (finalCashNoFreight + freight)));
  const installments = Array.isArray(proposal.installments) ? proposal.installments : [];
  const attachments = Array.isArray(proposal.attachments) ? proposal.attachments : [];
  const items = proposal.items.map((item) => `
    <tr>
      <td><b>${escapeHtml(item.product)}</b><br>${escapeHtml(item.line || "")}</td>
      <td>${escapeHtml(item.standard)}</td>
      <td>${escapeHtml(item.package)}</td>
      <td class="num">${escapeHtml(item.quantity)}</td>
      <td class="num">${money(item.unitPrice)}</td>
      <td class="num">${Number(item.discountPct || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</td>
      <td class="num">${money(item.total)}</td>
    </tr>`).join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(proposal.code)} - Riza Agro</title>
<style>
  @page{size:A4;margin:9mm}
  body{font-family:Arial,Segoe UI,sans-serif;color:#111;margin:0;background:#fff;font-size:11px}
  .topline{display:grid;grid-template-columns:1fr 1fr 1fr;font-size:9px;margin-bottom:12px}.topline div:nth-child(2){text-align:center}.topline div:nth-child(3){text-align:right}
  .header{display:grid;grid-template-columns:260px 1fr;gap:16px;align-items:center;border-bottom:4px solid #06451f;padding-bottom:10px;margin-bottom:16px}
  .logoBox img{max-width:250px;max-height:70px}.company{text-align:right;line-height:1.55}.company b{font-size:13px}
  .title{text-align:center}.title h1{color:#06451f;font-size:20px;margin:0 0 14px;font-weight:1000;letter-spacing:.02em}
  h2{font-size:13px;color:#06451f;margin:14px 0 8px;text-transform:uppercase}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:18px;border:1px solid #cfd8cf;border-radius:8px;padding:12px 14px;margin:10px 0 14px}
  .meta div{line-height:1.8}
  table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#fff;color:#999;text-transform:uppercase;font-size:9px;border-top:1.5px solid #06451f;border-bottom:1.5px solid #06451f}th,td{border:1px solid #cfd8cf;padding:8px;text-align:left}.num{text-align:right;font-weight:900}
  tfoot td{font-weight:1000;background:#fff;color:#111}.box{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.box>div{border:1px solid #cfd8cf;border-radius:8px;padding:12px;line-height:1.7;min-height:74px}
  .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:42px}.sign div{border-top:1px solid #111;text-align:center;padding-top:8px}
  .footer{margin-top:18px;text-align:center;color:#6b756e;font-size:10px;border-top:1px solid #dfe5df;padding-top:8px}
  .no-print{position:fixed;right:18px;top:18px;background:#063d21;color:#fff;border:0;border-radius:6px;padding:10px 14px;font-weight:800;cursor:pointer}
  @media print{.no-print{display:none}}
</style>
</head>
<body>
<button class="no-print" onclick="window.print()">Gerar PDF</button>
<div class="topline"><div>${escapeHtml(proposal.createdAtLabel || "")}</div><div>Proposta ${escapeHtml(proposal.customer.name || proposal.code)} - Riza Agro</div><div></div></div>
<div class="header">
  <div class="logoBox">${logo ? `<img src="${logo}" alt="Riza Agro">` : "Riza Agro"}</div>
  <div class="company"><b>Riza Agro</b><br>Solucoes em Pastagens<br>${escapeHtml((proposal.customer && proposal.customer.proposalDate) ? formatDate(proposal.customer.proposalDate) : (proposal.createdAtLabel || ""))}</div>
</div>
<div class="title"><h1>PROPOSTA COMERCIAL DE SEMENTES</h1></div>
<div class="meta">
  <div><b>Cliente:</b> ${escapeHtml(proposal.customer.name)}<br><b>Fazenda/Empresa:</b> ${escapeHtml(proposal.customer.company)}<br><b>CPF/CNPJ:</b> ${escapeHtml(proposal.customer.document)}<br><b>Inscricao Estadual:</b> ${escapeHtml(proposal.customer.stateRegistration || "")}<br><b>Contato:</b> ${escapeHtml(proposal.customer.phone)}</div>
  <div><b>E-mail:</b> ${escapeHtml(proposal.customer.email)}<br><b>Endereco:</b> ${escapeHtml(proposal.customer.address || "")}<br><b>CEP:</b> ${escapeHtml(proposal.customer.zip || "")}<br><b>Cidade/UF:</b> ${escapeHtml(proposal.customer.city)}<br><b>Consultor:</b> ${escapeHtml(proposal.createdByName)}<br><b>Validade:</b> ${escapeHtml(proposal.validity || "Conforme negociacao")}</div>
</div>
<h2>Itens da proposta</h2>
<table>
  <thead><tr><th>Cultivar/Linha</th><th>Padrao</th><th>Embalagem</th><th>Qtde</th><th>Valor/kg c/ juros</th><th>Desc.</th><th>Total c/ juros</th></tr></thead>
  <tbody>${items}</tbody>
  <tfoot><tr><td colspan="6">Total da Proposta sem Juros</td><td class="num">${money(finalCashNoFreight)}</td></tr>${freight > 0 ? `<tr><td colspan="6">Frete</td><td class="num">${money(freight)}</td></tr>` : ""}<tr><td colspan="6">Total Final Negociado</td><td class="num">${money(finalTotal)}</td></tr></tfoot>
</table>
<div class="box">
  <div><b>Condicao de Pagamento</b><br>Forma: ${escapeHtml(proposal.payment)}<br>Parcelas: ${installments.length ? `${installments.length}x` : "A combinar"}<br>Juros aplicado: ${Number(financial.interestPct || 2).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}% a.m.<br>Periodo aplicado: ${Number(financial.paymentHorizonMonths || Math.ceil(Number(financial.paymentHorizonDays || 0) / 30) || 0)} mes(es)</div>
  <div><b>Condicao Comercial</b><br>Validade: ${escapeHtml(proposal.validity || "conforme negociacao comercial")}<br>Frete: ${freight > 0 ? money(freight) : "conforme combinado"}</div>
</div>
${installments.length ? `<h2>Cronograma de parcelas</h2><table><thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr></thead><tbody>${installments.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.date)}</td><td class="num">${money(item.amount)}</td></tr>`).join("")}</tbody></table>` : ""}
<div style="margin-top:14px;line-height:1.6"><b>Observacoes:</b><br>1. Proposta sujeita a disponibilidade de estoque no momento do pedido.<br>2. Valores e condicoes conforme negociacao comercial informada.<br>3. Documento gerado para cliente conforme condicoes negociadas.${proposal.notes ? `<br>4. ${escapeHtml(proposal.notes)}` : ""}</div>
${attachments.length ? `<h2>Documentos anexos</h2><table><thead><tr><th>Arquivo</th><th>Tamanho</th></tr></thead><tbody>${attachments.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td class="num">${Number((item.size || 0) / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB</td></tr>`).join("")}</tbody></table>` : ""}
<div class="sign"><div>Consultor Comercial</div><div>Cliente / Aceite</div></div>
<div class="footer">Riza Agro - Solucoes em Pastagens</div>
<script>setTimeout(() => window.print(), 600);</script>
</body>
</html>`;
}

async function handleApi(req, res, pathname) {
  if (req.method === "POST" && pathname === "/api/login") {
    const body = await readBody(req);
    const db = readDb();
    const user = db.users.find((item) => item.email === body.email && item.password === body.password && item.active !== false);
    if (!user) return send(res, 401, { error: "E-mail ou senha invalidos." });
    const token = crypto.randomBytes(24).toString("hex");
    const safeUser = publicUser(user);
    sessions.set(token, safeUser);
    res.setHeader("Set-Cookie", `riza_session=${token}; HttpOnly; Path=/; SameSite=Lax`);
    return send(res, 200, { user: safeUser });
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    const token = parseCookies(req).riza_session;
    if (token) sessions.delete(token);
    res.setHeader("Set-Cookie", "riza_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
    return send(res, 200, { ok: true });
  }

  const user = currentUser(req);
  if (!user) return send(res, 401, { error: "Sessao expirada. Entre novamente." });

  if (req.method === "GET" && pathname === "/api/me") {
    return send(res, 200, { user });
  }

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    const db = readDb();
    const products = readProducts();
    return send(res, 200, {
      user,
      permissions: allPermissions,
      nextCode: proposalCode(db.nextProposalNumber),
      proposals: db.proposals.slice().reverse(),
      users: can(user, "users") ? db.users.map(publicUser) : [],
      clients: db.clients || [],
      products
    });
  }

  if (req.method === "GET" && pathname === "/api/proposals") {
    const db = readDb();
    return send(res, 200, {
      nextCode: proposalCode(db.nextProposalNumber),
      proposals: db.proposals.slice().reverse()
    });
  }

  if (req.method === "GET" && pathname === "/api/products") {
    return send(res, 200, { products: readProducts() });
  }

  if (req.method === "GET" && pathname === "/api/users") {
    const db = readDb();
    if (!can(user, "users")) return send(res, 403, { error: "Voce nao tem acesso a usuarios." });
    return send(res, 200, { users: db.users.map(publicUser), permissions: allPermissions });
  }

  if (req.method === "POST" && pathname === "/api/users") {
    const db = readDb();
    if (!can(user, "users")) return send(res, 403, { error: "Voce nao tem acesso a usuarios." });
    const body = await readBody(req);
    if (!body.name || !body.email || !body.password) return send(res, 400, { error: "Informe nome, e-mail e senha." });
    if (db.users.some((item) => item.email === body.email)) return send(res, 400, { error: "Ja existe usuario com este e-mail." });
    const newUser = {
      id: crypto.randomUUID(),
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role || "Consultor",
      active: true,
      permissions: Array.isArray(body.permissions) ? body.permissions : ["dashboard", "proposal", "history"]
    };
    db.users.push(newUser);
    writeDb(db);
    return send(res, 201, { user: publicUser(newUser), users: db.users.map(publicUser) });
  }

  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if ((req.method === "PATCH" || req.method === "PUT") && userMatch) {
    const db = readDb();
    if (!can(user, "users")) return send(res, 403, { error: "Voce nao tem acesso a usuarios." });
    const body = await readBody(req);
    const target = db.users.find((item) => item.id === userMatch[1]);
    if (!target) return send(res, 404, { error: "Usuario nao encontrado." });
    ["name", "email", "role", "password"].forEach((field) => {
      if (body[field] !== undefined && body[field] !== "") target[field] = body[field];
    });
    if (body.active !== undefined) target.active = !!body.active;
    if (Array.isArray(body.permissions)) target.permissions = body.permissions.filter((item) => allPermissions.includes(item));
    writeDb(db);
    return send(res, 200, { user: publicUser(target), users: db.users.map(publicUser) });
  }

  if (req.method === "DELETE" && userMatch) {
    const db = readDb();
    if (!can(user, "users")) return send(res, 403, { error: "Voce nao tem acesso a usuarios." });
    if (userMatch[1] === user.id) return send(res, 400, { error: "Voce nao pode excluir o usuario logado." });
    const before = db.users.length;
    db.users = db.users.filter((item) => item.id !== userMatch[1]);
    if (db.users.length === before) return send(res, 404, { error: "Usuario nao encontrado." });
    writeDb(db);
    return send(res, 200, { users: db.users.map(publicUser) });
  }

  if (req.method === "POST" && pathname === "/api/proposals") {
    const body = await readBody(req);
    const db = readDb();
    const number = db.nextProposalNumber++;
    const now = new Date();
    const proposal = {
      id: crypto.randomUUID(),
      number,
      code: proposalCode(number),
      status: "Emitida",
      customer: body.customer || {},
      items: (body.items || []).map((item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const cashUnitPrice = Number(item.cashUnitPrice || unitPrice);
        const discountPct = Number(item.discountPct || 0);
        const grossTotal = quantity * unitPrice;
        const grossCashTotal = quantity * cashUnitPrice;
        return {
          line: item.line,
          product: item.product,
          standard: item.standard,
          package: item.package,
          quantity,
          unitPrice,
          cashUnitPrice,
          discountPct,
          grossTotal,
          grossCashTotal,
          total: Math.max(0, grossTotal - grossTotal * discountPct / 100),
          cashTotal: Math.max(0, grossCashTotal - grossCashTotal * discountPct / 100)
        };
      }).filter((item) => item.product && item.quantity > 0),
      payment: body.payment || "A combinar",
      validity: body.validity || "",
      notes: body.notes || "",
      financial: body.financial || {},
      attachments: Array.isArray(body.attachments) ? body.attachments.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        size: Number(item.size || 0),
        content: item.content
      })) : [],
      createdBy: user.id,
      createdByName: user.name,
      createdAt: now.toISOString(),
      createdAtLabel: now.toLocaleString("pt-BR")
    };
    const gross = proposal.items.reduce((sum, item) => sum + item.grossTotal, 0);
    const cashGross = proposal.items.reduce((sum, item) => sum + item.grossCashTotal, 0);
    const itemDiscount = proposal.items.reduce((sum, item) => sum + (item.grossTotal - item.total), 0);
    const cashItemDiscount = proposal.items.reduce((sum, item) => sum + (item.grossCashTotal - item.cashTotal), 0);
    const discountPct = Number((proposal.financial && proposal.financial.discountPct) || 0);
    proposal.discount = round2(itemDiscount + Math.max(0, gross - itemDiscount) * discountPct / 100);
    proposal.cashDiscount = round2(cashItemDiscount + Math.max(0, cashGross - cashItemDiscount) * discountPct / 100);
    proposal.freight = (proposal.financial && proposal.financial.freightEnabled) ? round2(Math.max(0, Number(proposal.financial.freightValue || 0))) : 0;
    proposal.totalWithoutFreight = round2(Math.max(0, gross - proposal.discount));
    proposal.total = round2(proposal.totalWithoutFreight + proposal.freight);
    proposal.totalWithoutInterest = round2(Math.max(0, cashGross - proposal.cashDiscount) + proposal.freight);
    const entryPct = Number((proposal.financial && proposal.financial.entryPct) || 0);
    const interest = Number((proposal.financial && proposal.financial.interestPct) || 0) / 100;
    const count = Number((proposal.financial && proposal.financial.installments) || 0);
    if (Array.isArray(proposal.financial.installmentSchedule) && proposal.financial.installmentSchedule.length) {
      proposal.installments = proposal.financial.installmentSchedule
        .filter((item) => Number(item.amount || 0) > 0 || item.date)
        .map((item, index) => ({
          label: item.label || `Parcela ${index + 1}`,
          date: formatDate(item.date),
          amount: Number(item.amount || 0)
        }));
    } else if (count > 0) {
      const entry = proposal.totalWithoutFreight * entryPct / 100;
      const financed = proposal.total - entry;
      const totalWithInterest = entry + financed * Math.pow(1 + interest, count);
      const parcelAmount = round2((totalWithInterest - entry) / count);
      const baseDateValue = proposal.financial.entryDate || proposal.financial.firstInstallmentDate;
      const baseDate = baseDateValue ? new Date(`${baseDateValue}T00:00:00`) : new Date();
      proposal.installments = Array.from({ length: count }, (_, index) => {
        const date = new Date(baseDate);
        date.setMonth(date.getMonth() + index + 1);
        const amount = index === count - 1 ? round2(totalWithInterest - entry - parcelAmount * (count - 1)) : parcelAmount;
        return { label: `Parcela ${index + 1}`, date: date.toLocaleDateString("pt-BR"), amount };
      });
    } else {
      proposal.installments = [];
    }
    if (!proposal.customer.name) return send(res, 400, { error: "Informe o cliente." });
    if (!proposal.items.length) return send(res, 400, { error: "Adicione ao menos um item." });
    db.proposals.push(proposal);
    writeDb(db);
    return send(res, 201, { proposal, nextCode: proposalCode(db.nextProposalNumber) });
  }

  const pdfMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/pdf$/);
  if (req.method === "GET" && pdfMatch) {
    const db = readDb();
    const proposal = db.proposals.find((item) => item.id === pdfMatch[1]);
    if (!proposal) return send(res, 404, "Proposta nao encontrada.", "text/plain; charset=utf-8");
    return send(res, 200, pdfHtml(proposal), "text/html; charset=utf-8");
  }

  const proposalMatch = pathname.match(/^\/api\/proposals\/([^/]+)$/);
  if (req.method === "DELETE" && proposalMatch) {
    const db = readDb();
    if (!can(user, "history")) return send(res, 403, { error: "Voce nao tem acesso ao historico." });
    const before = db.proposals.length;
    db.proposals = db.proposals.filter((item) => item.id !== proposalMatch[1]);
    if (db.proposals.length === before) return send(res, 404, { error: "Proposta nao encontrada." });
    writeDb(db);
    return send(res, 200, { proposals: db.proposals.slice().reverse() });
  }

  return send(res, 404, { error: "Rota nao encontrada." });
}

function serveStatic(req, res, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, cleanPath));
  if (!filePath.startsWith(publicDir)) return send(res, 403, "Acesso negado.", "text/plain; charset=utf-8");
  fs.readFile(filePath, (error, data) => {
    if (error) return send(res, 404, "Arquivo nao encontrado.", "text/plain; charset=utf-8");
    send(res, 200, data, mimeTypes[path.extname(filePath)] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url.pathname);
    serveStatic(req, res, url.pathname);
  } catch (error) {
    send(res, 500, { error: error.message || "Erro interno." });
  }
});

const port = Number(process.env.PORT || 8787);
server.listen(port, () => {
  console.log(`Riza Agro teste rodando em http://localhost:${port}`);
});
