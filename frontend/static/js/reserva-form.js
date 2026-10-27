import { api, textoDoErro, textoGeral } from "./api.js";
import { iniciar } from "./sessao.js";
import { esc, icones, iconeVeiculo, debounce, guardarAviso, estadoVazio } from "./ui.js";
import { hojeISO, somarDias, dataCurta, nomeCategoria, horaAgora } from "./dominio.js";

const form = document.getElementById("form");
const $ = (id) => document.getElementById(id);
const CAMPOS = ["solicitante", "setor", "atividade", "origem", "destino", "data", "hora_saida", "data_retorno", "hora_retorno", "passageiros", "veiculo", "categoria_pretendida", "observacoes"];
const CAP_CATEGORIA = { LEVE: 4, COLETIVO: 18 };

const casaEditar = location.pathname.match(/^\/reservas\/(\d+)\/editar\/?$/);
const idEdicao = casaEditar ? Number(casaEditar[1]) : null;
let usuario, veiculos = [], original = null;
let seqDisp = 0, ctrlDisp = null;

// ---------- leitura do formulário ----------
const modo = () => form.elements.modo.value;
const volta = () => form.volta.checked;
const pax = () => { const n = Number(form.passageiros.value); return Number.isInteger(n) ? n : NaN; };
const veiculoEscolhido = () => veiculos.find((v) => String(v.id) === form.veiculo.value) || null;
function capacidadeEscolhida() {
  if (modo() === "veiculo") { const v = veiculoEscolhido(); return v ? { cap: v.capacidade, v } : null; }
  const c = form.categoria_pretendida.value;
  return c ? { cap: CAP_CATEGORIA[c], categoria: c } : null;
}
const dataRetornoEfetiva = () => (volta() ? form.data_retorno.value : form.data.value);

// ---------- mensagens por campo ----------
function caixaDe(nome) {
  const input = form.elements[nome];
  if (!input) return null;
  return input.closest(".in") || input.closest(".passo");
}
function limparMsgs(tipo, nome) {
  const seletor = `.msg[data-tipo="${tipo}"]${nome ? `[data-de="${nome}"]` : ""}`;
  form.querySelectorAll(seletor).forEach((m) => {
    const c = caixaDe(m.dataset.de);
    m.remove();
    if (c && !form.querySelector(`.msg[data-de="${m.dataset.de}"][data-tipo="${tipo}"]`)) { c.classList.remove(tipo === "erro" ? "erro" : "alerta"); }
    const inp = form.elements[m.dataset.de];
    if (inp && tipo === "erro") inp.removeAttribute("aria-invalid");
  });
}
function mostrarMsg(tipo, nome, texto) {
  const input = form.elements[nome];
  const caixa = caixaDe(nome);
  if (!input || !caixa) return;
  limparMsgs(tipo, nome);
  caixa.classList.add(tipo === "erro" ? "erro" : "alerta");
  const alvo = input.closest(".campo");
  const id = `msg-${tipo}-${nome}`;
  alvo.insertAdjacentHTML("beforeend", `<div class="msg ${tipo === "erro" ? "" : "alerta"}" id="${id}" data-tipo="${tipo}" data-de="${nome}" ${tipo === "erro" ? 'role="alert"' : ""}><i data-lucide="${tipo === "erro" ? "circle-x" : "triangle-alert"}"></i><span>${esc(texto)}</span></div>`);
  input.setAttribute("aria-describedby", id);
  if (tipo === "erro") input.setAttribute("aria-invalid", "true");
  icones();
}

// ---------- alertas de experiência (não bloqueiam o envio) ----------
function avaliarAlertas() {
  limparMsgs("alerta");
  const hoje = hojeISO();
  const data = form.data.value, ini = form.hora_saida.value, fim = form.hora_retorno.value;
  if (data && data < hoje) mostrarMsg("alerta", "data", "Esta data já passou. O servidor decide se aceita.");
  else if (data === hoje && ini && ini < horaAgora()) mostrarMsg("alerta", "hora_saida", `O horário ${ini} já passou hoje. O servidor decide se aceita.`);
  if (ini && fim) {
    if (!volta() && fim <= ini) mostrarMsg("alerta", "hora_retorno", "O retorno precisa ser depois da saída. Se a viagem passa da meia-noite, marque Volta no dia seguinte.");
    else if (volta() && form.data_retorno.value === data && fim <= ini) mostrarMsg("alerta", "hora_retorno", "No mesmo dia, o retorno precisa ser depois da saída.");
  }
  if (volta() && data && form.data_retorno.value) {
    const dr = form.data_retorno.value;
    if (dr < data) mostrarMsg("alerta", "data_retorno", "A data de retorno não pode ser antes da data de saída.");
    else if (dr > somarDias(data, 1)) mostrarMsg("alerta", "data_retorno", "O retorno pode ser, no máximo, 1 dia depois da saída.");
  }
  const n = pax();
  if (form.passageiros.value !== "") {
    const e = capacidadeEscolhida();
    if (n > 18) mostrarMsg("alerta", "passageiros", "O máximo é de 18 passageiros por reserva.");
    else if (n < 1) mostrarMsg("alerta", "passageiros", "Informe ao menos 1 passageiro.");
    else if (e && n > e.cap) {
      mostrarMsg("alerta", "passageiros", e.v
        ? `O veículo ${e.v.codigo} comporta ${e.cap} passageiros e você informou ${n}. O servidor decide ao enviar.`
        : `A categoria ${nomeCategoria(e.categoria)} comporta até ${e.cap} passageiros. Para ${n} pessoas, escolha Coletivo. O servidor decide ao enviar.`);
    }
  }
}

function atualizarPassos() {
  const grupos = { 1: ["solicitante", "setor", "atividade"], 2: ["origem", "destino"], 3: ["data", "hora_saida", "hora_retorno"], 4: ["passageiros"] };
  Object.entries(grupos).forEach(([n, nomes]) => {
    let ok = nomes.every((c) => form.elements[c].value.trim() !== "");
    if (n === "4") ok = ok && (modo() === "veiculo" ? !!form.veiculo.value : !!form.categoria_pretendida.value);
    const em = $(`bloco-${n}`).querySelector("h3 em");
    em.innerHTML = ok ? '<i data-lucide="check" class="p"></i>' : n;
  });
  icones();
}

// ---------- modo veículo / categoria ----------
function aplicarModo() {
  const porVeiculo = modo() === "veiculo";
  $("campo-veiculo").hidden = !porVeiculo;
  $("campo-categoria").hidden = porVeiculo;
}

function opcoesVeiculo() {
  const atual = original ? original.veiculo.id : null;
  const sel = form.veiculo;
  const valor = sel.value;
  sel.innerHTML = `<option value="">Selecione um veículo</option>` + veiculos
    .filter((v) => v.ativo || v.id === atual)
    .map((v) => `<option value="${v.id}">${esc(v.codigo)} · ${nomeCategoria(v.categoria)} · ${v.capacidade} lugares${v.ativo ? "" : " (inativo)"}</option>`).join("");
  sel.value = valor;
}

// ---------- disponibilidade ----------
function paramsDisp() {
  const n = pax();
  if (!form.data.value || !form.hora_saida.value || !form.hora_retorno.value || !(n >= 1 && n <= 18)) return null;
  const p = { data: form.data.value, saida: form.hora_saida.value, retorno: form.hora_retorno.value, passageiros: n };
  if (volta() && form.data_retorno.value) p.data_retorno = form.data_retorno.value;
  if (modo() === "categoria" && form.categoria_pretendida.value) p.categoria = form.categoria_pretendida.value;
  return p;
}
function resumoDisp(p) {
  const fim = p.data_retorno && p.data_retorno !== p.data ? `${dataCurta(p.data_retorno)} ${p.retorno}` : p.retorno;
  return `${dataCurta(p.data)} · ${p.saida} → ${fim} · ${p.passageiros} ${p.passageiros === 1 ? "pessoa" : "pessoas"}`;
}

function cartaoDisp(v, { sugerido, atual }) {
  const n = Math.max(0, pax() || 0);
  const sobra = v.capacidade - n;
  const escolhido = modo() === "veiculo" && form.veiculo.value === String(v.id);
  let txt = sugerido ? "Sugerido · menor que atende" : `${nomeCategoria(v.categoria)} · sobram ${Math.max(0, sobra)} ${sobra === 1 ? "lugar" : "lugares"}`;
  if (atual) txt = `Veículo atual · ${txt.replace("Sugerido · ", "")}`;
  return `<button type="button" role="radio" class="op" data-veiculo="${v.id}" aria-checked="${escolhido}">
    <span class="foto">${iconeVeiculo(v.categoria)}</span>
    <span><span class="l1"><b class="codigo">${esc(v.codigo)}</b><span class="radio" aria-hidden="true"></span></span>
    <span class="l2" style="display:block">${esc(txt)}</span>
    <span class="lug" aria-hidden="true">${Array.from({ length: v.capacidade }, (_, i) => `<i class="${i < n ? "p" : ""}"></i>`).join("")}</span></span>
  </button>`;
}

let ultimaLista = null;
function desenharDisp() {
  const ops = $("ops");
  if (!ultimaLista) return;
  const { disponiveis, p } = ultimaLista;
  ops.removeAttribute("aria-busy");
  const atualId = original ? original.veiculo.id : null;
  const extra = original && !disponiveis.some((v) => v.id === atualId) && !original.categoria_pretendida ? veiculos.find((v) => v.id === atualId) : null;
  const cartoes = [];
  if (extra) cartoes.push(cartaoDisp(extra, { atual: true }));
  disponiveis.forEach((v, i) => cartoes.push(cartaoDisp(v, { sugerido: i === 0, atual: v.id === atualId })));
  $("disp-qtd").textContent = `${disponiveis.length} ${disponiveis.length === 1 ? "veículo" : "veículos"}`;
  $("disp-resumo").textContent = resumoDisp(p);
  if (!disponiveis.length && !extra) {
    estadoVazio(ops, { icone: "car-front", titulo: "Nenhum veículo disponível", texto: "Nenhum veículo disponível nesse período. Tente outro horário." });
    return;
  }
  ops.innerHTML = (disponiveis.length ? "" : `<p class="rot">Nenhum veículo disponível nesse período. Tente outro horário.</p>`) + cartoes.join("");
  icones();
}

async function consultarDisp() {
  const ops = $("ops");
  const p = paramsDisp();
  if (ctrlDisp) ctrlDisp.abort();
  if (!p) {
    ultimaLista = null;
    $("disp-qtd").textContent = "";
    $("disp-resumo").textContent = "";
    ops.removeAttribute("aria-busy");
    ops.innerHTML = `<p class="rot" style="margin:0">Preencha data, saída, retorno e passageiros para ver os veículos livres nesse horário.</p>`;
    return;
  }
  const minha = ++seqDisp;
  ctrlDisp = new AbortController();
  ops.setAttribute("aria-busy", "true");
  ops.innerHTML = `<div class="esq" style="height:78px"></div><div class="esq" style="height:78px"></div>`;
  $("disp-resumo").textContent = resumoDisp(p);
  try {
    const r = await api.disponibilidade(p, ctrlDisp.signal);
    if (minha !== seqDisp) return;
    ultimaLista = { disponiveis: r.disponiveis || [], p };
    desenharDisp();
  } catch (erro) {
    if (erro.name === "AbortError" || minha !== seqDisp) return;
    ultimaLista = null;
    ops.removeAttribute("aria-busy");
    const lista = Object.values(erro.erros || {}).flat();
    const msg = lista.length ? lista.map((i) => textoDoErro("", i, { passageiros: p.passageiros, categoria: p.categoria, hora_saida: p.saida })).join(" ") : textoGeral(erro);
    ops.innerHTML = `<div class="msg" role="alert"><i data-lucide="circle-x"></i><span>${esc(msg)}</span></div>`;
    icones();
  }
}
const consultarDebounced = debounce(consultarDisp, 450);

// ---------- eventos do formulário ----------
function aoMudar(e) {
  if ($("aviso-topo").dataset.tipo === "obrigatorios" && !validarObrigatorios().length) esconderAvisoTopo();
  const nome = e && e.target && e.target.name;
  if (nome) { limparMsgs("erro", nome); if (nome === "veiculo" || nome === "categoria_pretendida" || nome === "modo") { limparMsgs("erro", "veiculo"); limparMsgs("erro", "categoria_pretendida"); } }
  $("cx-data-retorno").hidden = !volta();
  if (volta() && !form.data_retorno.value && form.data.value) form.data_retorno.value = somarDias(form.data.value, 1);
  if (!volta()) form.data_retorno.value = "";
  aplicarModo();
  avaliarAlertas();
  atualizarPassos();
  if (ultimaLista) desenharDisp();
  consultarDebounced();
}
form.addEventListener("input", aoMudar);
form.addEventListener("change", aoMudar);
$("menos").addEventListener("click", () => { form.passageiros.value = Math.max(1, (pax() || 1) - 1); aoMudar({ target: form.passageiros }); });
$("mais").addEventListener("click", () => { form.passageiros.value = Math.min(18, (pax() || 0) + 1); aoMudar({ target: form.passageiros }); });

$("ops").addEventListener("click", (e) => {
  const b = e.target.closest("[data-veiculo]");
  if (!b) return;
  form.modo.value = "veiculo";
  form.elements.modo[0].checked = true;
  form.veiculo.value = b.dataset.veiculo;
  aoMudar({ target: form.veiculo });
});

// ---------- aviso no topo ----------
function avisoTopo(titulo, mensagens) {
  const a = $("aviso-topo");
  a.hidden = false;
  $("aviso-titulo").textContent = titulo;
  const unicas = [...new Set(mensagens)];
  $("aviso-texto").innerHTML = unicas.length > 1
    ? `<p>Confira os campos destacados:</p><ul>${unicas.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`
    : `<p>${esc(unicas[0] || "")}</p>`;
}
const esconderAvisoTopo = () => { $("aviso-topo").hidden = true; $("aviso-topo").dataset.tipo = ""; };

// ---------- envio ----------
function validarObrigatorios() {
  const faltando = [];
  ["solicitante", "setor", "atividade", "origem", "destino", "data", "hora_saida", "hora_retorno", "passageiros"].forEach((c) => {
    if (form.elements[c].value.trim() === "") faltando.push([c, "Preencha este campo."]);
  });
  if (volta() && !form.data_retorno.value) faltando.push(["data_retorno", "Informe a data de retorno."]);
  if (modo() === "veiculo" && !form.veiculo.value) faltando.push(["veiculo", "Escolha um veículo ou uma categoria."]);
  if (modo() === "categoria" && !form.categoria_pretendida.value) faltando.push(["categoria_pretendida", "Escolha um veículo ou uma categoria."]);
  return faltando;
}

function montarPayload() {
  const v = {
    solicitante: form.solicitante.value.trim(), setor: form.setor.value.trim(), atividade: form.atividade.value.trim(),
    origem: form.origem.value.trim(), destino: form.destino.value.trim(), data: form.data.value,
    hora_saida: form.hora_saida.value, hora_retorno: form.hora_retorno.value, passageiros: pax(),
    observacoes: form.observacoes.value.trim(),
  };
  if (!original) {
    const corpo = { ...v };
    if (volta()) corpo.data_retorno = form.data_retorno.value;
    if (modo() === "veiculo") corpo.veiculo = Number(form.veiculo.value);
    else corpo.categoria_pretendida = form.categoria_pretendida.value;
    return corpo;
  }
  // edição: PATCH só com o que mudou (evita revalidar o que o usuário não tocou)
  const corpo = {};
  Object.entries(v).forEach(([k, val]) => { if (val !== original[k]) corpo[k] = val; });
  const origVolta = original.data_retorno !== original.data;
  if (volta()) { if (form.data_retorno.value !== original.data_retorno || v.data !== original.data) corpo.data_retorno = form.data_retorno.value; }
  else if (origVolta || v.data !== original.data) corpo.data_retorno = "";
  const agendaMudou = ["data", "hora_saida", "hora_retorno", "passageiros"].some((k) => k in corpo) || "data_retorno" in corpo;
  if (modo() === "veiculo") {
    const id = Number(form.veiculo.value);
    if (id !== original.veiculo.id || original.categoria_pretendida) { corpo.veiculo = id; corpo.categoria_pretendida = ""; }
  } else {
    const cat = form.categoria_pretendida.value;
    if (cat !== original.categoria_pretendida || agendaMudou) { corpo.veiculo = ""; corpo.categoria_pretendida = cat; }
  }
  return corpo;
}

function contextoErro() {
  return {
    veiculo: modo() === "veiculo" ? veiculoEscolhido() : (original ? original.veiculo : null),
    categoria: form.categoria_pretendida.value || (original && original.categoria_pretendida) || "LEVE",
    passageiros: pax(), hora_saida: form.hora_saida.value,
  };
}

function mostrarErrosServidor(erro, titulo) {
  limparMsgs("erro");
  const ctx = contextoErro();
  const mensagens = [];
  let primeiro = null;
  Object.entries(erro.erros || {}).forEach(([campo, lista]) => {
    if (!lista || !lista.length) return;
    const texto = textoDoErro(campo, lista[0], ctx);
    mensagens.push(texto);
    let alvo = campo;
    if (campo === "__all__") alvo = modo() === "veiculo" ? "veiculo" : "categoria_pretendida";
    if (alvo === "veiculo" && modo() === "categoria") alvo = "categoria_pretendida";
    if (alvo === "categoria_pretendida" && modo() === "veiculo" && lista[0].code !== "veiculo_obrigatorio" && campo !== "__all__") alvo = "veiculo";
    if (form.elements[alvo] && CAMPOS.includes(alvo)) {
      mostrarMsg("erro", alvo, texto);
      primeiro = primeiro || form.elements[alvo];
    }
  });
  if (!mensagens.length) mensagens.push(textoGeral(erro));
  avisoTopo(titulo, mensagens);
  const foco = primeiro && primeiro.type !== "hidden" ? primeiro : $("aviso-topo");
  if (foco === $("aviso-topo")) foco.setAttribute("tabindex", "-1");
  foco.focus();
  if (primeiro) primeiro.scrollIntoView({ block: "center" });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  esconderAvisoTopo();
  limparMsgs("erro");
  const faltando = validarObrigatorios();
  if (faltando.length) {
    faltando.forEach(([c, t]) => mostrarMsg("erro", c, t));
    avisoTopo("Preencha os campos obrigatórios", ["Os campos marcados são obrigatórios."]);
    $("aviso-topo").dataset.tipo = "obrigatorios";
    form.elements[faltando[0][0]].focus();
    return;
  }
  const titulo = idEdicao ? "Não foi possível salvar as alterações" : "Não foi possível registrar a reserva";
  const corpo = montarPayload();
  if (idEdicao && !Object.keys(corpo).length) {
    avisoTopo("Nada para salvar", ["Você não alterou nenhum campo."]);
    return;
  }
  const botao = $("enviar");
  botao.disabled = true;
  botao.setAttribute("aria-busy", "true");
  botao.textContent = idEdicao ? "Salvando…" : "Enviando…";
  try {
    const r = idEdicao ? await api.editarReserva(idEdicao, corpo) : await api.criarReserva(corpo);
    const res = r.reserva || {};
    const cod = res.veiculo ? res.veiculo.codigo : "";
    guardarAviso("sucesso", idEdicao ? `Reserva atualizada${cod ? ` · veículo ${cod}` : ""}.` : `Reserva registrada com sucesso${cod ? ` · veículo ${cod}` : ""}.`);
    (r.avisos || []).forEach((a) => guardarAviso("aviso", `${idEdicao ? "Reserva atualizada" : "Reserva registrada"}. Atenção: ${a}`));
    location.assign("/reservas/");
  } catch (erro) {
    botao.disabled = false;
    botao.removeAttribute("aria-busy");
    botao.textContent = idEdicao ? "Salvar alterações" : "Enviar reserva";
    mostrarErrosServidor(erro, titulo);
    if (erro.status === 409 || erro.status === 400) consultarDisp(); // atualiza as alternativas
  }
});

// ---------- início ----------
function preencher(r) {
  CAMPOS.forEach((c) => { if (!["veiculo", "categoria_pretendida", "data_retorno"].includes(c) && c in r) form.elements[c].value = r[c] ?? ""; });
  if (r.data_retorno && r.data_retorno !== r.data) { form.volta.checked = true; form.data_retorno.value = r.data_retorno; }
  if (r.categoria_pretendida) { form.elements.modo[1].checked = true; form.categoria_pretendida.value = r.categoria_pretendida; }
  else { form.elements.modo[0].checked = true; form.veiculo.value = String(r.veiculo.id); }
}

async function init() {
  usuario = await iniciar({ ativo: idEdicao ? "reservas" : "nova" });
  $("cx-data-retorno").hidden = true;
  try {
    veiculos = (await api.veiculos()).veiculos;
  } catch (erro) {
    avisoTopo("Não foi possível carregar os veículos", [textoGeral(erro)]);
  }
  if (idEdicao) {
    $("titulo").textContent = `Editar reserva ${idEdicao}`;
    $("sub").textContent = "Só os campos alterados são enviados ao servidor.";
    $("enviar").textContent = "Salvar alterações";
    document.title = `Editar reserva ${idEdicao} · COSEG Mobilidade`;
    try {
      const d = await api.reserva(idEdicao);
      original = d.reserva || d;
      if (!original || !original.veiculo) throw new Error("sem reserva");
    } catch (erro) {
      $("campos-form").disabled = true;
      $("enviar").disabled = true;
      avisoTopo("Não foi possível abrir a reserva", [erro.mensagem ? textoGeral(erro) : "Reserva não encontrada."]);
      icones();
      return;
    }
    opcoesVeiculo();
    preencher(original);
    if (original.status === "CANCELADA") {
      $("campos-form").disabled = true;
      $("enviar").disabled = true;
      avisoTopo("Reserva cancelada", [textoGeral({ codigo: "reserva_cancelada" })]);
    }
  } else {
    opcoesVeiculo();
    form.solicitante.value = usuario.nome || "";
    form.data.value = hojeISO();
    document.title = "Nova reserva · COSEG Mobilidade";
  }
  $("cx-data-retorno").hidden = !volta();
  aplicarModo();
  avaliarAlertas();
  atualizarPassos();
  consultarDisp();
  icones();
}
await init();
