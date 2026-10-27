// Utilitários de interface: escape de HTML, avisos (toasts), diálogos, estados e ícones.

/** Escapa texto vindo do servidor/usuário antes de entrar em HTML. */
export function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const LOGO = `<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="10" fill="#121417"/><path d="M22.8 11.6a7.6 7.6 0 1 0 0 10.8" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><circle cx="23.6" cy="17" r="2.5" fill="#3ccf9f"/></svg>`;

export function icones() {
  if (window.lucide) window.lucide.createIcons();
}

export const iconeVeiculo = (categoria) =>
  `<i class="ph-duotone ${categoria === "COLETIVO" ? "ph-van" : "ph-car-profile"}" aria-hidden="true"></i>`;

export function debounce(fn, ms = 400) {
  let t;
  const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  f.cancelar = () => clearTimeout(t);
  return f;
}

// ---------- avisos (toasts) ----------
function areaAvisos() {
  let a = document.getElementById("avisos");
  if (!a) {
    a = document.createElement("div");
    a.id = "avisos";
    a.setAttribute("aria-live", "polite");
    document.body.append(a);
  }
  return a;
}
const ICONE_AVISO = { sucesso: "check", erro: "octagon-alert", info: "info", aviso: "triangle-alert" };

/** tipo: sucesso | erro | info | aviso. Retorna função que fecha o aviso. */
export function toast(tipo, texto, { duracao } = {}) {
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.setAttribute("role", tipo === "erro" ? "alert" : "status");
  el.innerHTML = `<span class="i"><i data-lucide="${ICONE_AVISO[tipo] || "info"}"></i></span><p></p><button type="button" class="x" aria-label="Fechar aviso"><i data-lucide="x"></i></button>`;
  el.querySelector("p").textContent = texto;
  const fechar = () => el.remove();
  el.querySelector(".x").addEventListener("click", fechar);
  areaAvisos().append(el);
  icones();
  const ms = duracao ?? (tipo === "erro" || tipo === "aviso" ? 9000 : 5000);
  if (ms > 0) setTimeout(fechar, ms);
  return fechar;
}

// Avisos que sobrevivem a uma navegação (ex.: sucesso ao salvar -> volta para a lista).
const CHAVE_FLASH = "coseg:avisos";
export function guardarAviso(tipo, texto) {
  const lista = JSON.parse(sessionStorage.getItem(CHAVE_FLASH) || "[]");
  lista.push({ tipo, texto });
  sessionStorage.setItem(CHAVE_FLASH, JSON.stringify(lista));
}
export function mostrarAvisosGuardados() {
  const lista = JSON.parse(sessionStorage.getItem(CHAVE_FLASH) || "[]");
  sessionStorage.removeItem(CHAVE_FLASH);
  lista.forEach((a) => toast(a.tipo, a.texto, { duracao: a.tipo === "aviso" ? 12000 : 7000 }));
}

// ---------- diálogos (<dialog> nativo: foco preso, Esc fecha, devolve o foco ao acionador) ----------
/**
 * abrirDialogo({ titulo, corpo (HTML já escapado ou Node), acoes: [{rotulo, classe, tipo, aoClicar}] })
 * Retorna { dialog, corpoEl, fechar, erro(msg) }.
 */
export function abrirDialogo({ titulo, corpo = "", acoes = [], aoFechar }) {
  const d = document.createElement("dialog");
  const idT = "dlg-" + Math.random().toString(36).slice(2, 8);
  d.setAttribute("aria-labelledby", idT);
  d.innerHTML = `
    <div class="dlg-cab"><h2 id="${idT}"></h2><button type="button" class="dlg-x" aria-label="Fechar"><i data-lucide="x"></i></button></div>
    <div class="dlg-corpo"><div class="dlg-erro" role="alert" hidden></div><div class="dlg-conteudo"></div></div>
    <div class="dlg-acoes"></div>`;
  d.querySelector("h2").textContent = titulo;
  const corpoEl = d.querySelector(".dlg-conteudo");
  if (typeof corpo === "string") corpoEl.innerHTML = corpo; else corpoEl.append(corpo);
  const caixaErro = d.querySelector(".dlg-erro");
  const fechar = () => d.close();
  const ctrl = {
    dialog: d, corpoEl, fechar,
    erro(msg) { caixaErro.hidden = !msg; caixaErro.textContent = msg || ""; },
  };
  acoes.forEach((a) => {
    const b = document.createElement("button");
    b.type = a.tipo || "button";
    b.className = `btn ${a.classe || "lin"}`;
    b.textContent = a.rotulo;
    if (a.form) b.setAttribute("form", a.form);
    if (a.aoClicar) b.addEventListener("click", () => a.aoClicar(ctrl, b));
    else if (!a.form) b.addEventListener("click", fechar);
    d.querySelector(".dlg-acoes").append(b);
  });
  d.querySelector(".dlg-x").addEventListener("click", fechar);
  d.addEventListener("click", (e) => { if (e.target === d) fechar(); });
  d.addEventListener("close", () => { d.remove(); if (aoFechar) aoFechar(); });
  document.body.append(d);
  icones();
  d.showModal();
  return ctrl;
}

/** Diálogo de confirmação próprio (nunca usar confirm()). Resolve true/false. */
export function confirmar({ titulo, texto, rotuloOk = "Confirmar", rotuloNao = "Voltar", perigo = false }) {
  return new Promise((resolve) => {
    let resposta = false;
    const ctrl = abrirDialogo({
      titulo,
      corpo: `<p>${esc(texto)}</p>`,
      acoes: [
        { rotulo: rotuloNao, classe: "lin" },
        { rotulo: rotuloOk, classe: perigo ? "perigo" : "pri", aoClicar: (c) => { resposta = true; c.fechar(); } },
      ],
      aoFechar: () => resolve(resposta),
    });
    ctrl.dialog.querySelector(".dlg-acoes .btn").focus();
  });
}

// ---------- estados ----------
export function carregando(el, linhas = 3) {
  el.setAttribute("aria-busy", "true");
  el.innerHTML = `<div class="sr-only" role="status">Carregando…</div>` +
    Array.from({ length: linhas }, () => `<div class="esq" style="height:46px;margin-bottom:10px"></div>`).join("");
}
export function estadoErro(el, mensagem, aoTentar) {
  el.removeAttribute("aria-busy");
  el.innerHTML = `<div class="estado erro" role="alert"><span class="foto"><i data-lucide="cloud-off"></i></span><b>Não foi possível carregar</b><p>${esc(mensagem)}</p><button type="button" class="btn lin" data-tentar>Tentar de novo</button></div>`;
  el.querySelector("[data-tentar]").addEventListener("click", aoTentar);
  icones();
}
export function estadoVazio(el, { icone = "inbox", titulo, texto = "", acao }) {
  el.removeAttribute("aria-busy");
  el.innerHTML = `<div class="estado"><span class="foto"><i data-lucide="${esc(icone)}"></i></span><b>${esc(titulo)}</b>${texto ? `<p>${esc(texto)}</p>` : ""}${acao ? `<a class="btn pri" href="${esc(acao.href)}"><i data-lucide="plus"></i>${esc(acao.rotulo)}</a>` : ""}</div>`;
  icones();
}
