/**
 * Script injetado na página oficial da SEFAZ (WebView) depois de cada
 * carregamento. Ele só lê a página que já está na tela do aparelho e avisa o
 * app pelo `postMessage`:
 *
 * - `challenge`: a página pede uma verificação (Cloudflare Turnstile, reCAPTCHA).
 *   Nada é feito para burlar: a verificação roda como em qualquer navegador e,
 *   se pedir um toque, a pessoa toca na própria página.
 * - `note`: a nota apareceu. Manda loja, itens, totais, pagamento e data, no
 *   leiaute nacional da consulta resumida (`#tabResult`, `.txtTit`, `#totalNota`),
 *   que SP, ES e a maioria dos estados usam.
 * - `unknown`: passou o tempo e não reconheceu nada. Manda só a estrutura
 *   (ids e classes), sem texto, para ajustar o leitor daquele estado.
 *
 * O bloco "Consumidor" (CPF e nome) nunca é lido.
 *
 * Fica como texto puro, e não como função convertida com toString(), porque o
 * Hermes compila o JS do app e não guarda o código-fonte das funções.
 */
export const NFCE_PAGE_SCRIPT = String.raw`
(function () {
  if (window.__controlaiNfce) return;
  window.__controlaiNfce = true;

  function post(message) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
  function clean(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }
  function text(el) {
    return el ? clean(el.textContent) : "";
  }
  function afterColon(value) {
    var i = value.indexOf(":");
    return clean(i >= 0 ? value.slice(i + 1) : value);
  }
  function num(value) {
    var m = /-?\d[\d.]*(?:,\d+)?/.exec(value || "");
    if (!m) return null;
    var n = Number(m[0].replace(/\./g, "").replace(",", "."));
    return isFinite(n) ? n : null;
  }

  function readItems() {
    var items = [];
    var rows = document.querySelectorAll("#tabResult tr");
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var name = text(row.querySelector(".txtTit"));
      if (!name) continue;
      var code = /[0-9A-Za-z]+/.exec(afterColon(text(row.querySelector(".RCod"))).replace(/[()]/g, ""));
      items.push({
        name: name,
        code: code ? code[0] : null,
        quantity: num(afterColon(text(row.querySelector(".Rqtd")))),
        unit: afterColon(text(row.querySelector(".RUN"))) || null,
        unitPrice: num(afterColon(text(row.querySelector(".RvlUnit")))),
        total: num(text(row.querySelector(".valor")))
      });
    }
    return items;
  }

  function readTotals() {
    var totals = { itemCount: null, gross: null, discount: null, total: null, payments: [] };
    var lines = document.querySelectorAll("#totalNota > div");
    var inPayments = false;
    for (var i = 0; i < lines.length; i++) {
      var label = text(lines[i].querySelector("label")).toLowerCase();
      var value = text(lines[i].querySelector(".totalNumb"));
      if (lines[i].id === "linhaForma") { inPayments = true; continue; }
      if (inPayments) {
        // Pagamentos vêm em "label.tx"; depois vêm troco e a linha de tributos.
        if (!lines[i].querySelector("label.tx") || label.indexOf("troco") === 0) continue;
        totals.payments.push({ method: text(lines[i].querySelector("label")), amount: num(value) });
      } else if (label.indexOf("qtd") === 0) totals.itemCount = num(value);
      else if (label.indexOf("valor total") === 0) totals.gross = num(value);
      else if (label.indexOf("desconto") === 0) totals.discount = num(value);
      else if (label.indexOf("valor a pagar") === 0) totals.total = num(value);
    }
    if (totals.total === null) totals.total = totals.gross;
    return totals;
  }

  function readInfo() {
    var info = { issuedAt: null, number: null, accessKey: null };
    var general = text(document.querySelector("#infos"));
    var date = /Emiss[ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(general);
    if (date) info.issuedAt = date[3] + "-" + date[2] + "-" + date[1];
    var number = /N[úu]mero:\s*(\d+)/i.exec(general);
    if (number) info.number = number[1];
    var key = text(document.querySelector(".chave")).replace(/\s/g, "");
    if (key) info.accessKey = key;
    return info;
  }

  function readNote() {
    var items = readItems();
    if (!items.length) return null;
    var merchant = text(document.querySelector("#u20")) || text(document.querySelector(".txtTopo"));
    var cnpj = null;
    var headers = document.querySelectorAll(".txtCenter .text");
    for (var i = 0; i < headers.length; i++) {
      var h = text(headers[i]);
      if (/CNPJ/i.test(h)) { cnpj = afterColon(h).replace(/[^0-9A-Za-z]/g, ""); break; }
    }
    var totals = readTotals();
    var info = readInfo();
    return {
      merchant: merchant,
      cnpj: cnpj,
      issuedAt: info.issuedAt,
      number: info.number,
      accessKey: info.accessKey,
      items: items,
      itemCount: totals.itemCount,
      gross: totals.gross,
      discount: totals.discount,
      total: totals.total,
      payments: totals.payments
    };
  }

  function challengeKind() {
    if (document.querySelector(".cf-turnstile, iframe[src*='challenges.cloudflare.com']")) return "turnstile";
    if (document.querySelector(".g-recaptcha, iframe[src*='recaptcha']")) return "recaptcha";
    if (document.querySelector(".h-captcha, iframe[src*='hcaptcha']")) return "hcaptcha";
    if (/just a moment|um momento/i.test(document.title)) return "cloudflare";
    return null;
  }

  function structure() {
    var seen = {};
    var all = document.querySelectorAll("[id],[class]");
    for (var i = 0; i < all.length && i < 400; i++) {
      if (all[i].id) seen["#" + all[i].id] = 1;
      var classes = (all[i].getAttribute("class") || "").split(/\s+/);
      for (var j = 0; j < classes.length; j++) if (classes[j]) seen["." + classes[j]] = 1;
    }
    return Object.keys(seen).slice(0, 120);
  }

  var lastType = null;
  var started = Date.now();
  function check() {
    var note = null;
    try { note = readNote(); } catch (e) { note = null; }
    if (note) {
      post({ type: "note", note: note });
      return true;
    }
    var kind = challengeKind();
    if (kind && lastType !== "challenge") {
      lastType = "challenge";
      post({ type: "challenge", kind: kind });
    }
    if (!kind && Date.now() - started > 15000 && lastType !== "unknown") {
      lastType = "unknown";
      post({ type: "unknown", title: document.title, url: location.host + location.pathname, structure: structure() });
    }
    return false;
  }

  if (!check()) {
    var timer = setInterval(function () {
      if (check() || Date.now() - started > 90000) clearInterval(timer);
    }, 700);
  }
})();
true;
`;
