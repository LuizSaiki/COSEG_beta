import { api, textoGeral } from "./api.js";
import { iniciar } from "./sessao.js";
import { esc, icones, iconeVeiculo, toast, abrirDialogo, confirmar, carregando, estadoErro, estadoVazio } from "./ui.js";
import {
  hojeISO, dataCurta, dataCompleta, diaCurto, intervaloSemana, rotuloSemana, situacao, intervalo,
  ROTULO_SITUACAO, CLASSE_SITUACAO, nomeCategoria, iniciais, semAcento,
} from "./dominio.js";

const POR_PAGINA = 10;
const el = (id) => document.getElementById(id);
let coseg = false;
let todas = [];   // tudo que o usuário pode ver (semana e listas de filtro)
let lista = [];   // resultado da consulta, filtrado no servidor quando há dia único e/ou veículo
let seq = 0;
const f = { aba: "todas", de: "", ate: "", veiculo: "", setor: "", q: new URLSearchParams(location.search).get("q") || "", pagina: 1 };
const hoje = hojeISO();

// ---------- carga ----------
async function carregar() {
  carregando(el("tabela"), 5);
  el("pag").hidden = true;
  try {
    const r = await api.reservas();
    todas = r.reservas;
    await atualizarLista();
  } catch (erro) {
    estadoErro(el("tabela"), textoGeral(erro), carregar);
  }
}

// ---------- filtros ----------
// RF05: dia único e veículo vão na query; período de vários dias continua no navegador.
async function atualizarLista() {
  const consulta = {};
  if (f.de && f.de === f.ate) consulta.data = f.de;
  if (f.veiculo) consulta.veiculo = f.veiculo;
  if (!Object.keys(consulta).length) { lista = todas; desenhar(); return; }
  const minha = ++seq;
  carregando(el("tabela"), 4);
  el("pag").hidden = true;
  try {
    const r = await api.reservas(consulta);
    if (minha !== seq) return;
    lista = r.reservas;
    desenhar();
  } catch (erro) {
    if (minha !== seq) return;
    estadoErro(el("tabela"), textoGeral(erro), atualizarLista);
  }
}
const agora = () => new Date();
function comSit(lista) {
  const a = agora();
  return lista.map((r) => ({ r, sit: situacao(r, a), ...intervalo(r) }));
}
function baseFiltrada() {
  const q = semAcento(f.q.trim());
  return comSit(lista).filter(({ r }) =>
    (!f.de || r.data >= f.de) && (!f.ate || r.data <= f.ate) &&
    (!f.veiculo || r.veiculo.codigo === f.veiculo) && (!f.setor || r.setor === f.setor) &&
    (!q || semAcento(`${r.solicitante} ${r.atividade} ${r.setor} ${r.veiculo.codigo} ${r.origem} ${r.destino}`).includes(q)));
}
const noDia = (x, dia) => x.sit !== "cancelada" && (x.r.data === dia || x.r.data_retorno === dia);
const ABAS = {
  todas: () => true,
  hoje: (x) => noDia(x, hoje),
  proximas: (x) => x.sit === "agendada",
  concluidas: (x) => x.sit === "concluida",
  canceladas: (x) => x.sit === "cancelada",
};
const ROTULO_ABA = { todas: "Todas", hoje: "Hoje", proximas: "Próximas", concluidas: "Concluídas", canceladas: "Canceladas" };

function desenhar() {
  desenharSemana();
  desenharFiltros();
  const base = baseFiltrada();
  el("abas").innerHTML = Object.keys(ABAS).map((k) =>
    `<button type="button" class="pilula ${k === f.aba ? "on" : "f"}" data-aba="${k}" aria-pressed="${k === f.aba}">${ROTULO_ABA[k]} <b>${base.filter(ABAS[k]).length}</b></button>`).join("");
  let lista = base.filter(ABAS[f.aba]);
  lista.sort((a, b) => (f.aba === "proximas" ? a.ini - b.ini : b.ini - a.ini));
  desenharTabela(lista);
  icones();
}

function desenharSemana() {
  const dias = intervaloSemana();
  el("sub-semana").textContent = `Semana de ${rotuloSemana(dias)}`;
  const validas = todas.filter((r) => r.status !== "CANCELADA");
  el("semana").innerHTML = dias.map((d) => {
    const q = validas.filter((r) => r.data === d).length;
    const fds = ["sáb", "dom"].includes(diaCurto(d));
    const ativo = f.de === d && f.ate === d;
    return `<button type="button" class="dia ${d === hoje ? "hoje" : ""} ${fds ? "fds" : ""}" data-dia="${d}" aria-pressed="${ativo}" aria-label="${diaCurto(d)} ${dataCurta(d)}, ${q} ${q === 1 ? "reserva" : "reservas"}. Filtrar por este dia">${diaCurto(d)} <b>${d.slice(8)}</b><small>${q ? `${q} ${q === 1 ? "reserva" : "reservas"}` : "—"}</small></button>`;
  }).join("");
}

function desenharFiltros() {
  const preencher = (id, valores, atual, rotulo) => {
    const s = el(id);
    s.innerHTML = `<option value="">${rotulo}</option>` + valores.map((v) => `<option value="${esc(v)}" ${v === atual ? "selected" : ""}>${esc(v)}</option>`).join("");
    s.closest("label").classList.toggle("set", !!atual);
  };
  const unicos = (fn) => [...new Set(todas.map(fn))].sort((a, b) => a.localeCompare(b, "pt", { numeric: true }));
  preencher("f-veiculo", unicos((r) => r.veiculo.codigo), f.veiculo, "Veículo");
  preencher("f-setor", unicos((r) => r.setor), f.setor, "Setor");
  const temPeriodo = f.de || f.ate;
  const rotulo = temPeriodo ? `${f.de ? dataCurta(f.de) : "…"} – ${f.ate ? dataCurta(f.ate) : "…"}` : "Período";
  const aberto = el("periodo").querySelector(".pop");
  const mantem = aberto ? aberto.outerHTML : "";
  el("periodo").innerHTML = `<span class="pilula ${temPeriodo ? "set" : "f"}" style="gap:8px">
      <button type="button" data-periodo style="border:0;background:transparent;display:inline-flex;gap:6px;align-items:center;font-weight:600;font-size:13px;padding:0" aria-haspopup="dialog" aria-expanded="${!!aberto}"><i data-lucide="calendar" class="p"></i>${rotulo}</button>
      ${temPeriodo ? `<button type="button" class="limpa" data-limpar-periodo aria-label="Limpar período"><i data-lucide="x" class="p"></i></button>` : ""}</span>${mantem}`;
}

// ---------- tabela ----------
function linha({ r, sit }) {
  const v = r.veiculo;
  const agendada = sit === "agendada" || sit === "andamento"; // back permite editar/cancelar ATIVA a qualquer momento
  const acoes = `<a href="#" data-ver="${r.id}" role="button" aria-label="Ver detalhes da reserva ${r.id}" title="Ver"><i data-lucide="eye"></i></a>` +
    (agendada ? `<a href="/reservas/${r.id}/editar/" aria-label="Editar reserva ${r.id}" title="Editar"><i data-lucide="pencil"></i></a>
      <button type="button" data-cancelar="${r.id}" aria-label="Cancelar reserva ${r.id}" title="Cancelar"><i data-lucide="x"></i></button>` : "") +
    (coseg ? `<button type="button" class="perigo" data-excluir="${r.id}" aria-label="Excluir reserva ${r.id}" title="Excluir"><i data-lucide="trash-2"></i></button>` : "");
  return `<tr class="${sit === "cancelada" ? "cancel" : ""}">
    <td class="c-vei"><div class="vei"><div class="foto">${iconeVeiculo(v.categoria)}</div><div><b class="codigo">${esc(v.codigo)}</b><span>${nomeCategoria(v.categoria)}</span></div></div></td>
    <td class="c-pes"><div class="pes"><span class="av sm">${esc(iniciais(r.solicitante))}</span><div><b>${esc(r.solicitante)}</b><span>${esc(r.setor)}</span></div></div></td>
    <td class="c-tra"><div class="tra"><b>${esc(r.atividade)}</b><span>${esc(r.origem)} → ${esc(r.destino)}</span></div></td>
    <td data-rotulo="Saída"><div class="hr"><b>${esc(r.hora_saida)}</b><span>${dataCompleta(r.data)}</span></div></td>
    <td data-rotulo="Retorno"><div class="hr"><b>${esc(r.hora_retorno)}</b><span>${dataCompleta(r.data_retorno || r.data)}</span></div></td>
    <td data-rotulo="Pessoas"><span class="pax"><i data-lucide="users-round"></i>${r.passageiros}</span></td>
    <td data-rotulo="Situação"><span class="st ${CLASSE_SITUACAO[sit]}">${ROTULO_SITUACAO[sit]}</span></td>
    <td class="c-ac"><div class="ac">${acoes}</div></td>
  </tr>`;
}

function desenharTabela(lista) {
  const alvo = el("tabela");
  alvo.removeAttribute("aria-busy");
  if (!lista.length) {
    el("pag").hidden = true;
    const filtrado = f.q || f.de || f.ate || f.veiculo || f.setor || f.aba !== "todas";
    estadoVazio(alvo, {
      icone: "calendar-x-2",
      titulo: filtrado ? "Nenhuma reserva encontrada" : "Você ainda não tem reservas",
      texto: filtrado ? "Ajuste os filtros ou faça uma nova reserva." : "Faça a primeira reserva de veículo.",
      acao: { href: "/reservas/nova/", rotulo: "Nova reserva" },
    });
    return;
  }
  const paginas = Math.ceil(lista.length / POR_PAGINA);
  f.pagina = Math.min(f.pagina, paginas);
  const ini = (f.pagina - 1) * POR_PAGINA;
  const parte = lista.slice(ini, ini + POR_PAGINA);
  alvo.innerHTML = `<table><thead><tr><th scope="col">Veículo</th><th scope="col">Solicitante</th><th scope="col">Atividade e trajeto</th><th scope="col">Saída</th><th scope="col">Retorno</th><th scope="col">Pessoas</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead><tbody>${parte.map(linha).join("")}</tbody></table>`;

  const nums = [];
  for (let p = 1; p <= paginas; p++) {
    if (p === 1 || p === paginas || Math.abs(p - f.pagina) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const pag = el("pag");
  pag.hidden = false;
  pag.innerHTML = `<span>Mostrando ${ini + 1}–${ini + parte.length} de ${lista.length} ${lista.length === 1 ? "reserva" : "reservas"}</span>
    <nav class="nums" aria-label="Paginação"><button type="button" data-pagina="${f.pagina - 1}" aria-label="Página anterior" ${f.pagina === 1 ? "disabled" : ""}><i data-lucide="chevron-left" class="p"></i></button>
    ${nums.map((n) => n === "…" ? "<span>…</span>" : `<button type="button" data-pagina="${n}" ${n === f.pagina ? 'aria-current="page"' : ""} aria-label="Página ${n}">${n}</button>`).join("")}
    <button type="button" data-pagina="${f.pagina + 1}" aria-label="Próxima página" ${f.pagina === paginas ? "disabled" : ""}><i data-lucide="chevron-right" class="p"></i></button></nav>`;
}

// ---------- ações ----------
const achar = (id) => todas.find((r) => r.id === Number(id));

function detalhes(r) {
  const sit = situacao(r);
  const agendada = sit === "agendada" || sit === "andamento"; // back permite editar/cancelar ATIVA a qualquer momento
  const item = (rot, val, todo) => `<div class="${todo ? "todo" : ""}"><span>${rot}</span><b>${esc(val)}</b></div>`;
  const acoes = [{ rotulo: "Fechar", classe: "lin" }];
  if (agendada) {
    acoes.push({ rotulo: "Cancelar reserva", classe: "lin perigo", aoClicar: (c) => { c.fechar(); cancelar(r); } });
    acoes.push({ rotulo: "Editar", classe: "pri", aoClicar: () => location.assign(`/reservas/${r.id}/editar/`) });
  }
  abrirDialogo({
    titulo: `Reserva ${r.id} · ${r.veiculo.codigo}`,
    corpo: `<div class="detalhe">
      ${item("Situação", ROTULO_SITUACAO[sit])}${item("Veículo", `${r.veiculo.codigo} · ${nomeCategoria(r.veiculo.categoria)} · ${r.veiculo.capacidade} lugares`)}
      ${item("Solicitante", r.solicitante)}${item("Setor", r.setor)}
      ${item("Atividade", r.atividade, true)}${item("Trajeto", `${r.origem} → ${r.destino}`, true)}
      ${item("Saída", `${dataCompleta(r.data)} às ${r.hora_saida}`)}${item("Retorno", `${dataCompleta(r.data_retorno || r.data)} às ${r.hora_retorno}`)}
      ${item("Passageiros", String(r.passageiros))}${r.categoria_pretendida ? item("Categoria pedida", nomeCategoria(r.categoria_pretendida)) : item("Criada por", r.criado_por || "—")}
      ${r.observacoes ? item("Observações", r.observacoes, true) : ""}</div>`,
    acoes,
  });
}

async function cancelar(r) {
  const ok = await confirmar({
    titulo: "Cancelar esta reserva?",
    texto: `A reserva de ${r.solicitante} (${r.veiculo.codigo}, ${dataCurta(r.data)} das ${r.hora_saida} às ${r.hora_retorno}) será cancelada e o veículo ficará livre.`,
    rotuloOk: "Cancelar reserva", rotuloNao: "Manter reserva", perigo: true,
  });
  if (!ok) return;
  try {
    await api.cancelarReserva(r.id);
    toast("sucesso", "Reserva cancelada. O veículo foi liberado.");
  } catch (erro) {
    toast(erro.codigo === "ja_cancelada" ? "info" : "erro", textoGeral(erro));
  }
  await carregar();
}

async function excluir(r) {
  const ok = await confirmar({
    titulo: "Excluir esta reserva?",
    texto: `A reserva ${r.id} de ${r.solicitante} (${r.veiculo.codigo}, ${dataCurta(r.data)}) será apagada de vez. Para manter o histórico, use Cancelar.`,
    rotuloOk: "Excluir", rotuloNao: "Voltar", perigo: true,
  });
  if (!ok) return;
  try {
    await api.excluirReserva(r.id);
    toast("sucesso", "Reserva excluída.");
  } catch (erro) {
    toast("erro", textoGeral(erro));
  }
  await carregar();
}

// ---------- eventos ----------
document.addEventListener("click", (e) => {
  const t = e.target;
  const aba = t.closest("[data-aba]");
  if (aba) { f.aba = aba.dataset.aba; f.pagina = 1; desenhar(); el("abas").querySelector(`[data-aba="${f.aba}"]`).focus(); return; }
  const dia = t.closest("[data-dia]");
  if (dia) {
    const d = dia.dataset.dia;
    const jaAtivo = f.de === d && f.ate === d;
    f.de = jaAtivo ? "" : d; f.ate = jaAtivo ? "" : d; f.pagina = 1;
    atualizarLista().then(() => { const b = el("semana").querySelector(`[data-dia="${d}"]`); if (b) b.focus(); }); return;
  }
  const pg = t.closest("[data-pagina]");
  if (pg && !pg.disabled) { f.pagina = Number(pg.dataset.pagina); desenhar(); (el("pag").querySelector("[aria-current]") || el("pag")).focus(); el("tabela").scrollIntoView({ block: "start" }); return; }
  const ver = t.closest("[data-ver]");
  if (ver) { e.preventDefault(); const r = achar(ver.dataset.ver); if (r) detalhes(r); return; }
  const can = t.closest("[data-cancelar]");
  if (can) { const r = achar(can.dataset.cancelar); if (r) cancelar(r); return; }
  const exc = t.closest("[data-excluir]");
  if (exc) { const r = achar(exc.dataset.excluir); if (r) excluir(r); return; }
  if (t.closest("[data-limpar-periodo]")) { f.de = f.ate = ""; f.pagina = 1; atualizarLista(); return; }
  if (t.closest("[data-periodo]")) { alternarPopover(); return; }
  if (!t.closest(".periodo")) fecharPopover();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharPopover(true); });

el("f-veiculo").addEventListener("change", (e) => { f.veiculo = e.target.value; f.pagina = 1; atualizarLista(); });
el("f-setor").addEventListener("change", (e) => { f.setor = e.target.value; f.pagina = 1; desenhar(); });
el("busca").value = f.q;
el("busca").addEventListener("input", (e) => { f.q = e.target.value; f.pagina = 1; desenhar(); });
el("form-busca").addEventListener("submit", (e) => e.preventDefault());

function fecharPopover(devolverFoco) {
  const p = el("periodo").querySelector(".pop");
  if (!p) return;
  p.remove();
  const b = el("periodo").querySelector("[data-periodo]");
  b.setAttribute("aria-expanded", "false");
  if (devolverFoco) b.focus();
}
function alternarPopover() {
  if (el("periodo").querySelector(".pop")) { fecharPopover(true); return; }
  el("periodo").insertAdjacentHTML("beforeend", `<div class="pop" role="dialog" aria-label="Filtrar por período">
    <div class="campo"><label for="p-de">De</label><div class="in"><input type="date" id="p-de" value="${f.de}"></div></div>
    <div class="campo"><label for="p-ate">Até</label><div class="in"><input type="date" id="p-ate" value="${f.ate}"></div></div>
    <div class="acoes"><button type="button" class="btn lin" id="p-limpar">Limpar</button><button type="button" class="btn pri" id="p-aplicar">Aplicar</button></div></div>`);
  el("periodo").querySelector("[data-periodo]").setAttribute("aria-expanded", "true");
  el("p-de").focus();
  el("p-aplicar").addEventListener("click", () => {
    f.de = el("p-de").value; f.ate = el("p-ate").value;
    if (f.de && f.ate && f.ate < f.de) [f.de, f.ate] = [f.ate, f.de];
    f.pagina = 1; fecharPopover(); atualizarLista();
  });
  el("p-limpar").addEventListener("click", () => { f.de = f.ate = ""; f.pagina = 1; fecharPopover(); atualizarLista(); });
}

// ---------- início ----------
const usuario = await iniciar({ ativo: "reservas" });
coseg = !!usuario.coseg;
await carregar();
icones();
