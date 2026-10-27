import { api, textoDoErro, textoGeral } from "./api.js";
import { iniciar } from "./sessao.js";
import { esc, icones, iconeVeiculo, toast, abrirDialogo, confirmar, estadoErro, estadoVazio } from "./ui.js";
import { hojeISO, somarDias, intervalo, situacao, horaAgora, nomeCategoria, semAcento, ROTULO_SITUACAO } from "./dominio.js";

const el = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
let usuario, coseg = false;
let veiculos = [], reservas = [];
let filtro = "todos", busca = "", selecionadoId = null;

// ---------- situação derivada ----------
function infoVeiculo(v, agora = new Date()) {
  const minhas = reservas
    .filter((r) => r.veiculo.codigo === v.codigo && r.status !== "CANCELADA")
    .map((r) => ({ r, sit: situacao(r, agora), ...intervalo(r) }))
    .sort((a, b) => a.ini - b.ini);
  const uso = minhas.find((x) => x.sit === "andamento");
  const prox = minhas.find((x) => x.sit === "agendada");
  let estado = "ativo";
  if (!v.ativo) estado = "inativo";
  else if (coseg) estado = uso ? "uso" : "livre"; // colaborador só enxerga as próprias reservas
  return { minhas, uso, prox, estado };
}
const hm = (d) => horaAgora(d);

function rotuloEstado(v, info, longo = false) {
  switch (info.estado) {
    case "inativo": return `<span class="st inativo">Inativo</span>`;
    case "uso": return `<span class="st uso">${longo ? `Em uso até ${hm(info.uso.fim)}` : "Em uso"}</span>`;
    case "livre": return `<span class="st livre">Livre</span>`;
    default: return `<span class="st neutro">Ativo</span>`;
  }
}

// ---------- carregar ----------
async function carregar() {
  try {
    const hoje = hojeISO();
    const [v, r, o] = await Promise.all([
      api.veiculos(),
      api.reservas({ data: hoje }),
      api.reservas({ data: somarDias(hoje, -1) }).catch(() => ({ reservas: [] })),
    ]);
    const mapa = new Map();
    r.reservas.forEach((x) => mapa.set(x.id, x));
    o.reservas.filter((x) => x.data_retorno === hoje).forEach((x) => mapa.set(x.id, x));
    veiculos = v.veiculos.sort((a, b) => a.codigo.localeCompare(b.codigo, "pt", { numeric: true }));
    reservas = [...mapa.values()];
    if (!veiculos.some((x) => x.id === selecionadoId)) {
      const emUso = veiculos.find((x) => infoVeiculo(x).estado === "uso");
      selecionadoId = (emUso || veiculos[0] || {}).id ?? null;
    }
    desenhar();
  } catch (erro) {
    estadoErro(el("lista"), textoGeral(erro), carregar);
    el("detalhe").hidden = true;
  }
}

// ---------- filtros ----------
function contagens() {
  const c = { todos: veiculos.length, livres: 0, uso: 0, inativos: 0, ativos: 0 };
  veiculos.forEach((v) => {
    const e = infoVeiculo(v).estado;
    if (e === "livre") c.livres++;
    if (e === "uso") c.uso++;
    if (e === "inativo") c.inativos++; else c.ativos++;
  });
  return c;
}
function desenharFiltros() {
  const c = contagens();
  const itens = coseg
    ? [["todos", "Todos", c.todos], ["livres", "Livres", c.livres], ["uso", "Em uso", c.uso], ["inativos", "Inativos", c.inativos]]
    : [["todos", "Todos", c.todos], ["ativos", "Ativos", c.ativos], ["inativos", "Inativos", c.inativos]];
  el("filtros").innerHTML = itens.map(([k, n, q]) =>
    `<button type="button" class="pilula ${k === filtro ? "on" : ""}" data-filtro="${k}" aria-pressed="${k === filtro}">${n} <b>${q}</b></button>`).join("");
  el("sub").textContent = `${veiculos.length} ${veiculos.length === 1 ? "veículo" : "veículos"} · situação às ${horaAgora()}`;
}
function passaFiltro(v) {
  const e = infoVeiculo(v).estado;
  const ok = filtro === "todos" || (filtro === "livres" && e === "livre") || (filtro === "uso" && e === "uso")
    || (filtro === "inativos" && e === "inativo") || (filtro === "ativos" && e !== "inativo");
  const q = semAcento(busca.trim());
  return ok && (!q || semAcento(`${v.codigo} ${nomeCategoria(v.categoria)}`).includes(q));
}

// ---------- lista ----------
function cartao(v) {
  const info = infoVeiculo(v);
  let rodape;
  if (info.estado === "inativo") rodape = ["wrench", "Fora de operação"];
  else if (!coseg) rodape = ["users-round", `Até ${v.capacidade} lugares`];
  else if (info.uso) rodape = ["corner-down-left", `Volta às ${hm(info.uso.fim)}`];
  else if (info.prox) rodape = ["clock", `Próxima saída ${hm(info.prox.ini)}`];
  else rodape = ["check", "Livre o dia todo"];
  return `<button type="button" class="vc ${v.ativo ? "" : "off"}" data-id="${v.id}" aria-pressed="${v.id === selecionadoId}">
    <span class="foto">${iconeVeiculo(v.categoria)}</span>
    <span class="l1"><b class="codigo">${esc(v.codigo)}</b></span>
    <span class="l2">${rotuloEstado(v, info)}</span>
    <span class="l3"><i data-lucide="${rodape[0]}"></i>${esc(rodape[1])}</span>
  </button>`;
}
function desenharLista() {
  const vis = veiculos.filter(passaFiltro);
  el("lista").removeAttribute("aria-busy");
  if (!veiculos.length) {
    estadoVazio(el("lista"), { icone: "car-front", titulo: "Nenhum veículo cadastrado", texto: coseg ? "Use Cadastrar veículo para começar." : "" });
    return;
  }
  if (!vis.length) {
    estadoVazio(el("lista"), { icone: "search-x", titulo: "Nenhum veículo encontrado", texto: "Ajuste o filtro ou a busca." });
    return;
  }
  const secao = (cat, titulo, grade, sub) => {
    const l = vis.filter((v) => v.categoria === cat);
    return l.length ? `<div class="secao"><h2>${titulo}</h2><span>${sub}</span></div><div class="grade ${grade}">${l.map(cartao).join("")}</div>` : "";
  };
  const cap = (cat) => (veiculos.find((v) => v.categoria === cat) || {}).capacidade;
  el("lista").innerHTML =
    secao("COLETIVO", "Coletivos", "col", `${cap("COLETIVO") ? `até ${cap("COLETIVO")} passageiros · ` : ""}treinamentos e visitas técnicas`) +
    secao("LEVE", "Leves", "lev", `${cap("LEVE") ? `até ${cap("LEVE")} passageiros · ` : ""}reuniões, inspeções e deslocamentos`);
  icones();
}

// ---------- painel do veículo ----------
function desenharDetalhe() {
  const d = el("detalhe");
  const v = veiculos.find((x) => x.id === selecionadoId);
  if (!v) { d.hidden = true; return; }
  d.hidden = false;
  const agora = new Date();
  const info = infoVeiculo(v, agora);
  const hoje = hojeISO();
  const doDia = info.minhas.filter((x) => x.r.data === hoje || x.r.data_retorno === hoje);

  let lugares = "";
  if (info.uso) {
    const pax = info.uso.r.passageiros;
    lugares = `<div><div class="rot">Lugares nesta saída · ${pax} de ${v.capacidade}</div>
      <div class="assentos ${v.capacidade > 8 ? "muitos" : ""}" aria-hidden="true">${Array.from({ length: v.capacidade }, (_, i) => `<i class="${i < pax ? "" : "vago"}">${i < pax ? '<i data-lucide="user"></i>' : ""}</i>`).join("")}</div></div>`;
  }

  let agenda = "";
  if (!v.ativo) {
    agenda = `<div class="it"><b>Fora de operação</b><p>Veículo inativo não recebe novas reservas.</p></div>`;
  } else {
    agenda = doDia.map((x) => `<div class="it ${x.sit === "andamento" ? "uso" : ""}"><b>${hm(x.ini)} – ${hm(x.fim)} · ${esc(ROTULO_SITUACAO[x.sit].toLowerCase())}</b><p>${esc(x.r.solicitante)} · ${esc(x.r.atividade)} · ${esc(x.r.destino)}</p></div>`).join("");
    const ultimoFim = doDia.reduce((m, x) => (x.fim > m ? x.fim : m), new Date(0));
    agenda += `<div class="it liv"><b>${!doDia.length ? "Livre o dia todo" : ultimoFim > agora ? `A partir de ${hm(ultimoFim)}` : "Livre agora"}</b><p>${coseg ? "Livre para reservas" : "Sem outras reservas suas hoje"}</p></div>`;
  }

  const acoes = coseg ? `<div class="acoes">
      <button type="button" class="btn lin" data-acao="editar"><i data-lucide="pencil"></i>Editar</button>
      <button type="button" class="btn lin" data-acao="alternar"><i data-lucide="power"></i>${v.ativo ? "Desativar" : "Ativar"}</button>
      <button type="button" class="btn lin perigo" data-acao="excluir"><i data-lucide="trash-2"></i>Excluir</button></div>`
    : `<p class="so-leitura"><i data-lucide="eye" class="p"></i>Somente consulta. A gestão da frota é do COSEG.</p>`;

  d.innerHTML = `
    <div class="t"><span class="foto">${iconeVeiculo(v.categoria)}</span><b class="codigo">${esc(v.codigo)}</b>${rotuloEstado(v, info, true)}</div>
    <div class="specs">
      <div><span>Categoria</span><b>${nomeCategoria(v.categoria)}</b></div>
      <div><span>Capacidade</span><b>${v.capacidade} lugares</b></div>
      <div><span>${coseg ? "Reservas hoje" : "Suas reservas hoje"}</span><b>${doDia.length}</b></div>
      <div><span>Situação</span><b>${v.ativo ? "Ativo" : "Inativo"}</b></div>
    </div>
    ${lugares}
    <div><div class="rot" style="margin-bottom:10px">${coseg ? "Agenda de hoje" : "Suas reservas hoje"}</div><div class="ag">${agenda}</div></div>
    ${acoes}`;
  icones();
}

function desenhar() {
  desenharFiltros();
  desenharLista();
  desenharDetalhe();
}

// ---------- eventos ----------
el("filtros").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filtro]");
  if (!b) return;
  filtro = b.dataset.filtro;
  desenharFiltros();
  desenharLista();
});
el("busca").addEventListener("input", (e) => { busca = e.target.value; desenharLista(); });
el("form-busca").addEventListener("submit", (e) => e.preventDefault());
el("lista").addEventListener("click", (e) => {
  const c = e.target.closest(".vc");
  if (!c) return;
  selecionadoId = Number(c.dataset.id);
  el("lista").querySelectorAll(".vc").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
  desenharDetalhe();
  if (window.matchMedia("(max-width: 900px)").matches) el("detalhe").scrollIntoView({ block: "start" });
});
el("detalhe").addEventListener("click", (e) => {
  const b = e.target.closest("[data-acao]");
  const v = veiculos.find((x) => x.id === selecionadoId);
  if (!b || !v) return;
  if (b.dataset.acao === "editar") dialogoVeiculo(v);
  if (b.dataset.acao === "alternar") alternarAtivo(v);
  if (b.dataset.acao === "excluir") excluir(v);
});
el("cadastrar").addEventListener("click", () => dialogoVeiculo(null));

// ---------- gestão (COSEG) ----------
function marcarErros(form, erros, ctx) {
  form.querySelectorAll(".msg").forEach((m) => m.remove());
  form.querySelectorAll(".in.erro").forEach((i) => i.classList.remove("erro"));
  let primeiro = null;
  Object.entries(erros || {}).forEach(([campo, lista]) => {
    const input = form.elements[campo];
    if (!input || !lista.length) return;
    const caixa = input.closest(".in");
    caixa.classList.add("erro");
    input.setAttribute("aria-invalid", "true");
    caixa.parentElement.insertAdjacentHTML("beforeend", `<div class="msg" role="alert"><i data-lucide="circle-x"></i><span>${esc(textoDoErro(campo, lista[0], ctx))}</span></div>`);
    primeiro = primeiro || input;
  });
  icones();
  if (primeiro) primeiro.focus();
  return !!primeiro;
}

function dialogoVeiculo(v) {
  const editar = !!v;
  const idForm = "form-veiculo";
  const ctrl = abrirDialogo({
    titulo: editar ? `Editar ${v.codigo}` : "Cadastrar veículo",
    corpo: `<form id="${idForm}" novalidate>
      <div class="campos" style="grid-template-columns:1fr">
        <div class="campo"><label for="f-codigo">Código <em>*</em></label><div class="in"><input id="f-codigo" name="codigo" value="${esc(v ? v.codigo : "")}" placeholder="Ex.: VL-09" maxlength="20" autocomplete="off" required></div></div>
        <div class="campo"><label for="f-categoria">Categoria <em>*</em></label><div class="in"><select id="f-categoria" name="categoria">
          <option value="LEVE" ${v && v.categoria === "LEVE" ? "selected" : ""}>Leve · 4 lugares</option>
          <option value="COLETIVO" ${v && v.categoria === "COLETIVO" ? "selected" : ""}>Coletivo · 18 lugares</option></select><i data-lucide="chevron-down" class="fim"></i></div></div>
        ${editar ? "" : `<label class="volta"><input type="checkbox" name="ativo" checked>Veículo ativo (pode receber reservas)</label>`}
      </div></form>`,
    acoes: [
      { rotulo: "Cancelar", classe: "lin" },
      { rotulo: editar ? "Salvar alterações" : "Cadastrar", classe: "pri", tipo: "submit", form: idForm },
    ],
  });
  const form = ctrl.dialog.querySelector("form");
  const salvar = ctrl.dialog.querySelector('button[type="submit"]');
  form.querySelector("input").focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    ctrl.erro("");
    const codigo = form.codigo.value.trim();
    if (!codigo) { marcarErros(form, { codigo: [{ code: "required" }] }); return; }
    const corpo = { codigo, categoria: form.categoria.value };
    if (!editar) corpo.ativo = form.ativo.checked;
    else {
      Object.keys(corpo).forEach((k) => { if (corpo[k] === v[k]) delete corpo[k]; });
      if (!Object.keys(corpo).length) { ctrl.fechar(); return; }
    }
    salvar.disabled = true; salvar.setAttribute("aria-busy", "true");
    try {
      const r = editar ? await api.editarVeiculo(v.id, corpo) : await api.criarVeiculo(corpo);
      ctrl.fechar();
      const novo = r.veiculo || {};
      if (novo.id) selecionadoId = novo.id;
      toast("sucesso", editar ? "Veículo atualizado." : `Veículo ${novo.codigo || codigo} cadastrado.`);
      await carregar();
    } catch (erro) {
      salvar.disabled = false; salvar.removeAttribute("aria-busy");
      const tem = erro.erros && Object.keys(erro.erros).length;
      const comCampo = tem && marcarErros(form, erro.erros);
      if (erro.erros && erro.erros.__all__) ctrl.erro(textoDoErro("__all__", erro.erros.__all__[0]));
      else if (!comCampo) ctrl.erro(textoGeral(erro));
      else if (erro.erros.categoria && erro.erros.categoria[0].code === "reservas_incompativeis") ctrl.erro(textoDoErro("categoria", erro.erros.categoria[0]));
    }
  });
}

async function alternarAtivo(v) {
  const desativar = v.ativo;
  const ok = await confirmar({
    titulo: desativar ? `Desativar ${v.codigo}?` : `Ativar ${v.codigo}?`,
    texto: desativar ? "Veículo inativo continua na lista, mas não recebe novas reservas." : "O veículo volta a poder receber reservas.",
    rotuloOk: desativar ? "Desativar" : "Ativar", rotuloNao: "Voltar",
  });
  if (!ok) return;
  try {
    await api.editarVeiculo(v.id, { ativo: !v.ativo });
    toast("sucesso", desativar ? `${v.codigo} desativado.` : `${v.codigo} ativado.`);
    await carregar();
  } catch (erro) {
    toast("erro", textoGeral(erro));
  }
}

async function excluir(v) {
  const ok = await confirmar({ titulo: `Excluir ${v.codigo}?`, texto: "A exclusão é definitiva. Veículo com reservas não pode ser excluído.", rotuloOk: "Excluir", perigo: true });
  if (!ok) return;
  try {
    await api.excluirVeiculo(v.id);
    toast("sucesso", `${v.codigo} excluído.`);
    await carregar();
  } catch (erro) {
    if (erro.codigo === "veiculo_com_reservas") {
      abrirDialogo({
        titulo: "Não foi possível excluir",
        corpo: `<p>${esc(textoGeral(erro))}</p>`,
        acoes: [
          { rotulo: "Fechar", classe: "lin" },
          { rotulo: "Desativar veículo", classe: "pri", aoClicar: async (c) => { c.fechar(); if (v.ativo) await alternarAtivo(v); else toast("info", `${v.codigo} já está inativo.`); } },
        ],
      });
    } else toast("erro", textoGeral(erro));
  }
}

// ---------- início ----------
usuario = await iniciar({ ativo: params.get("gestao") ? "gestao" : "frota" });
coseg = !!usuario.coseg;
el("cadastrar").hidden = !coseg;
el("lista").setAttribute("aria-busy", "true");
await carregar();
if (coseg && params.get("gestao")) el("cadastrar").focus();
icones();
