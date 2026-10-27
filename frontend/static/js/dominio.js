// Datas, horas e situação derivada das reservas. Só apresentação:
// quem decide conflito, capacidade e disponibilidade é o servidor.

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const dois = (n) => String(n).padStart(2, "0");

export function paraISO(d) {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}
export function deISO(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}
export const hojeISO = () => paraISO(new Date());
export function somarDias(iso, n) {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return paraISO(d);
}
export const horaAgora = (d = new Date()) => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
export const paraMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

/** "2026-10-27" -> "27/10" */
export const dataCurta = (iso) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
/** "2026-10-27" -> "27/10/2026" */
export const dataCompleta = (iso) => { const [a, m, d] = iso.split("-"); return `${d}/${m}/${a}`; };
export const nomeDia = (iso) => DIAS[deISO(iso).getDay()];
export const diaCurto = (iso) => DIAS_CURTOS[deISO(iso).getDay()];
export function dataPorExtenso(d = new Date()) {
  const s = DIAS[d.getDay()];
  return `${s[0].toUpperCase()}${s.slice(1)}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
export function intervaloSemana(d = new Date()) {
  const seg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(seg); x.setDate(seg.getDate() + i); return paraISO(x); });
}
export function rotuloSemana(dias) {
  const a = deISO(dias[0]), b = deISO(dias[6]);
  const fim = `${b.getDate() === 1 ? "1º" : b.getDate()} de ${MESES[b.getMonth()]}`;
  return a.getMonth() === b.getMonth() ? `${a.getDate()} a ${fim}` : `${a.getDate()} de ${MESES[a.getMonth()]} a ${fim}`;
}

/** Início e fim da reserva como Date local. */
export function intervalo(r) {
  const ini = new Date(`${r.data}T${r.hora_saida.slice(0, 5)}:00`);
  const fim = new Date(`${r.data_retorno || r.data}T${r.hora_retorno.slice(0, 5)}:00`);
  return { ini, fim };
}

/** cancelada | agendada | andamento | concluida */
export function situacao(r, agora = new Date()) {
  if (r.status === "CANCELADA") return "cancelada";
  const { ini, fim } = intervalo(r);
  if (agora < ini) return "agendada";
  if (agora < fim) return "andamento";
  return "concluida";
}
export const ROTULO_SITUACAO = { agendada: "Agendada", andamento: "Em andamento", concluida: "Concluída", cancelada: "Cancelada" };
export const CLASSE_SITUACAO = { agendada: "livre", andamento: "uso", concluida: "neutro", cancelada: "erro" };

export const nomeCategoria = (c) => (c === "COLETIVO" ? "Coletivo" : "Leve");
export const primeiroNome = (n = "") => n.trim().split(/\s+/)[0] || "";
export const iniciais = (n = "") => {
  const p = n.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
};
export const semAcento = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function saudacao(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
