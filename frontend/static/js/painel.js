import { api, textoGeral } from "./api.js";
import { iniciar, saudacao, primeiroNome } from "./sessao.js";
import { esc, icones, iconeVeiculo, estadoErro, estadoVazio } from "./ui.js";
import { hojeISO, somarDias, intervalo, situacao, dataPorExtenso, horaAgora } from "./dominio.js";

const JANELA_INI = 7, JANELA_FIM = 19; // linha do tempo 07h–19h
const el = (id) => document.getElementById(id);
let usuario, dados = null;

document.getElementById("form-busca").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = el("busca").value.trim();
  location.assign("/reservas/" + (q ? "?q=" + encodeURIComponent(q) : ""));
});

async function carregar() {
  const hoje = hojeISO();
  try {
    const [v, hojeR, ontemR] = await Promise.all([
      api.veiculos(),
      api.reservas({ data: hoje }),
      api.reservas({ data: somarDias(hoje, -1) }).catch(() => ({ reservas: [] })),
    ]);
    const mapa = new Map();
    hojeR.reservas.forEach((r) => mapa.set(r.id, r));
    // viagem de ontem que volta hoje também ocupa o dia
    ontemR.reservas.filter((r) => r.data_retorno === hoje).forEach((r) => mapa.set(r.id, r));
    dados = { veiculos: v.veiculos, reservas: [...mapa.values()], hoje };
    desenhar();
  } catch (erro) {
    if (!dados) {
      const msg = textoGeral(erro);
      estadoErro(el("tl-area"), msg, carregar);
      el("kpis").innerHTML = "";
      el("rua").innerHTML = "";
    }
  }
}

function posicao(d, base) {
  const ini = new Date(`${base}T${String(JANELA_INI).padStart(2, "0")}:00:00`);
  const fim = new Date(`${base}T${String(JANELA_FIM).padStart(2, "0")}:00:00`);
  return Math.min(100, Math.max(0, ((d - ini) / (fim - ini)) * 100));
}

function desenhar() {
  const agora = new Date();
  const { veiculos, reservas, hoje } = dados;
  el("data-hora").textContent = `${dataPorExtenso(agora)} · ${horaAgora(agora)}`;

  const validas = reservas.filter((r) => r.status !== "CANCELADA").map((r) => ({ r, sit: situacao(r, agora), ...intervalo(r) }));
  const ativos = veiculos.filter((v) => v.ativo);
  const emAndamento = validas.filter((x) => x.sit === "andamento");
  const codigosEmUso = new Set(emAndamento.map((x) => x.r.veiculo.codigo));
  const usoAtivos = ativos.filter((v) => codigosEmUso.has(v.codigo)).length;
  const livres = ativos.length - usoAtivos;
  const proxRetorno = [...emAndamento].sort((a, b) => a.fim - b.fim)[0];
  const doDia = validas.filter((x) => x.r.data === hoje);
  const aSair = doDia.filter((x) => x.sit === "agendada").sort((a, b) => a.ini - b.ini);
  const hm = (d) => horaAgora(d);

  el("kpis").innerHTML = `
    <div class="card kpi"><span class="rot">Em uso agora</span><div class="n">${usoAtivos}<small>de ${ativos.length} ativos</small></div>
      <div class="seg" aria-hidden="true">${ativos.map((v) => `<i class="${codigosEmUso.has(v.codigo) ? "u" : ""}"></i>`).join("")}</div></div>
    <div class="card kpi"><span class="rot">Livres agora</span><div class="n">${livres}</div>
      <div class="rot">${proxRetorno ? `Próximo retorno: ${esc(proxRetorno.r.veiculo.codigo)} às ${hm(proxRetorno.fim)}` : "Nenhum veículo na rua"}</div></div>
    <div class="card kpi"><span class="rot">Reservas hoje</span><div class="n">${doDia.length}</div>
      <div class="rot">${aSair.length ? `${aSair.length} ainda ${aSair.length === 1 ? "vai" : "vão"} sair · próxima às ${hm(aSair[0].ini)}` : "Nenhuma saída pendente"}</div></div>`;

  // linha do tempo
  const horas = Array.from({ length: JANELA_FIM - JANELA_INI }, (_, i) => `<span>${String(JANELA_INI + i).padStart(2, "0")}h</span>`).join("");
  let foraDaJanela = 0;
  const linhas = veiculos.map((v) => {
    let barras = v.ativo ? "" : `<div class="ev off">Inativo</div>`;
    validas.filter((x) => x.r.veiculo.codigo === v.codigo).forEach((x) => {
      const l = posicao(x.ini, hoje), f = posicao(x.fim, hoje);
      if (f <= l) { foraDaJanela += 1; return; }
      const classe = { agendada: "agendada", andamento: "andamento", concluida: "concluida" }[x.sit];
      barras += `<div class="ev ${classe}" style="left:calc(${l}% + 2px);width:calc(${f - l}% - 4px)" title="${esc(x.r.solicitante)} · ${esc(x.r.atividade)}">${esc(primeiroNome(x.r.solicitante))}<small>${esc(x.r.hora_saida)}–${esc(x.r.hora_retorno)}</small></div>`;
    });
    return `<div class="tl-r"><b>${esc(v.codigo)}</b><div class="pista">${barras}</div></div>`;
  }).join("");
  const dentro = agora.getHours() >= JANELA_INI && agora.getHours() < JANELA_FIM;
  const marca = dentro ? `<div class="agora" style="left:calc(84px + (100% - 84px) * ${posicao(agora, hoje) / 100})"><span>${horaAgora(agora)}</span></div>` : "";
  el("tl-area").removeAttribute("aria-busy");
  el("tl-area").innerHTML = veiculos.length
    ? `<div class="tl-rolagem"><div class="tl-largura"><div class="tl-h" style="margin:24px 0 4px"><span></span><div class="horas" aria-hidden="true">${horas}</div></div><div style="position:relative">${linhas}${marca}</div></div></div>
       ${foraDaJanela ? `<p class="rot" style="margin:10px 0 0">${foraDaJanela} ${foraDaJanela === 1 ? "reserva fora" : "reservas fora"} da janela 07h–19h.</p>` : ""}`
    : "";
  if (!veiculos.length) estadoVazio(el("tl-area"), { icone: "car-front", titulo: "Nenhum veículo cadastrado" });

  // na rua agora
  const rua = [...emAndamento].sort((a, b) => a.fim - b.fim);
  if (!rua.length) {
    estadoVazio(el("rua"), { icone: "parking-square", titulo: "Nenhum veículo na rua agora", texto: aSair.length ? `Próxima saída às ${hm(aSair[0].ini)}.` : "" });
  } else {
    el("rua").innerHTML = rua.map((x) => {
      const feito = Math.round(((agora - x.ini) / (x.fim - x.ini)) * 100);
      return `<div class="it"><div class="foto">${iconeVeiculo(x.r.veiculo.categoria)}</div><div><div class="l1"><b class="codigo">${esc(x.r.veiculo.codigo)}</b><span class="h">volta ${esc(x.r.hora_retorno)}</span></div><p>${esc(x.r.solicitante)} · ${esc(x.r.destino)}</p><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.max(0, feito))}" aria-label="Progresso da viagem de ${esc(x.r.veiculo.codigo)}"><i style="width:${Math.min(100, Math.max(0, feito))}%"></i></div></div></div>`;
    }).join("");
  }
  icones();
}

usuario = await iniciar({ ativo: "painel", soCoseg: true });
el("saudacao").textContent = `${saudacao()}, ${primeiroNome(usuario.nome || usuario.username)}`;
el("tl-area").setAttribute("aria-busy", "true");
el("tl-area").innerHTML = `<div class="esq" style="height:280px"></div>`;
el("rua").innerHTML = `<div class="esq" style="height:120px"></div>`;
await carregar();
setInterval(carregar, 60000);
icones();
