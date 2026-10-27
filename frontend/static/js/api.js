// Camada de acesso à API. Uma única função de requisição (requisitar) normaliza
// respostas e erros. A tela só muda depois da resposta do servidor.

const BASE = "/api/";

export class ErroApi extends Error {
  constructor({ status = 0, mensagem = "", erros = {}, codigo = null }) {
    super(mensagem);
    this.status = status;
    this.mensagem = mensagem;
    this.erros = erros || {};
    this.codigo = codigo;
  }
}

export function lerCookie(nome) {
  const par = document.cookie.split("; ").find((c) => c.startsWith(nome + "="));
  return par ? decodeURIComponent(par.slice(nome.length + 1)) : "";
}

async function garantirCsrf() {
  let token = lerCookie("csrftoken");
  if (!token) {
    await fetch(BASE + "csrf/", { credentials: "same-origin" });
    token = lerCookie("csrftoken");
  }
  return token;
}

export function irParaLogin(expirou = true) {
  const volta = location.pathname + location.search;
  const qs = new URLSearchParams({ volta });
  if (expirou) qs.set("expirou", "1");
  location.assign("/entrar/?" + qs.toString());
}

const MENSAGENS_STATUS = {
  403: "Você não tem permissão para fazer isso.",
  404: "Este registro não existe mais.",
  429: "Muitas tentativas. Aguarde alguns minutos para tentar de novo.",
  500: "Não foi possível concluir agora. Tente de novo em instantes.",
};
const MSG_REDE = "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.";

/**
 * requisitar(metodo, caminho, { corpo, consulta, semRedirecionar, sinal })
 * Resolve com o JSON da resposta (2xx) ou rejeita com ErroApi {status, mensagem, erros, codigo}.
 */
export async function requisitar(metodo, caminho, opcoes = {}) {
  const { corpo, consulta, semRedirecionar = false, sinal, _repetiu = false } = opcoes;
  let url = BASE + caminho;
  if (consulta) {
    const qs = new URLSearchParams();
    Object.entries(consulta).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, v);
    });
    const s = qs.toString();
    if (s) url += "?" + s;
  }
  const init = { method: metodo, credentials: "same-origin", headers: { Accept: "application/json" }, signal: sinal };
  if (metodo !== "GET") {
    init.headers["X-CSRFToken"] = await garantirCsrf();
    if (corpo !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(corpo);
    }
  }

  let resp;
  try {
    resp = await fetch(url, init);
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ErroApi({ status: 0, mensagem: MSG_REDE, codigo: "rede" });
  }

  let dados = null;
  try {
    dados = await resp.json();
  } catch {
    dados = null;
  }

  if (resp.ok) return dados ?? {};

  const erro = new ErroApi({
    status: resp.status,
    mensagem: (dados && dados.mensagem) || MENSAGENS_STATUS[resp.status] || MSG_REDE,
    erros: (dados && dados.erros) || {},
    codigo: (dados && dados.codigo) || null,
  });

  // CSRF vencido: busca novo token e tenta uma vez
  if (resp.status === 403 && erro.codigo === "csrf" && !_repetiu) {
    document.cookie = "csrftoken=; Max-Age=0; path=/";
    return requisitar(metodo, caminho, { ...opcoes, _repetiu: true });
  }
  if (resp.status === 401 && !semRedirecionar) {
    irParaLogin(true);
    return new Promise(() => {}); // a página vai sair; não deixa a tela seguir
  }
  if (resp.status === 429) erro.mensagem = MENSAGENS_STATUS[429];
  throw erro;
}

export const api = {
  csrf: () => requisitar("GET", "csrf/", { semRedirecionar: true }),
  login: (username, password) => requisitar("POST", "login/", { corpo: { username, password }, semRedirecionar: true }),
  logout: () => requisitar("POST", "logout/", { semRedirecionar: true }),
  eu: (semRedirecionar = false) => requisitar("GET", "eu/", { semRedirecionar }),
  veiculos: () => requisitar("GET", "veiculos/"),
  criarVeiculo: (corpo) => requisitar("POST", "veiculos/", { corpo }),
  editarVeiculo: (id, corpo) => requisitar("PATCH", `veiculos/${id}/`, { corpo }),
  excluirVeiculo: (id) => requisitar("DELETE", `veiculos/${id}/`),
  reservas: (consulta) => requisitar("GET", "reservas/", { consulta }),
  reserva: (id) => requisitar("GET", `reservas/${id}/`),
  criarReserva: (corpo) => requisitar("POST", "reservas/", { corpo }),
  editarReserva: (id, corpo) => requisitar("PATCH", `reservas/${id}/`, { corpo }),
  cancelarReserva: (id) => requisitar("POST", `reservas/${id}/cancelar/`, { corpo: {} }),
  excluirReserva: (id) => requisitar("DELETE", `reservas/${id}/`),
  disponibilidade: (consulta, sinal) => requisitar("GET", "disponibilidade/", { consulta, sinal }),
};

// ---------- tradução das respostas para linguagem do usuário (docs/requisitos.md, seção 5) ----------
const nomeCategoria = (c) => (c === "COLETIVO" ? "Coletivo" : "Leve");

/**
 * Decide pelo code, nunca pelo texto do servidor.
 * ctx: { veiculo:{codigo,capacidade,categoria}|null, categoria, passageiros, hora_saida }
 */
export function textoDoErro(campo, item, ctx = {}) {
  const code = item.code;
  const v = ctx.veiculo;
  switch (code) {
    case "capacidade_excedida":
      if (v) return `O veículo ${v.codigo} comporta ${v.capacidade} passageiros e você informou ${ctx.passageiros}. Escolha um veículo de maior capacidade.`;
      return `A categoria ${nomeCategoria(ctx.categoria)} comporta até ${ctx.categoria === "COLETIVO" ? 18 : 4} passageiros. Para ${ctx.passageiros} pessoas, escolha Coletivo.`;
    case "acima_do_limite": return "O máximo é de 18 passageiros por reserva.";
    case "passageiros_invalido": return "Informe ao menos 1 passageiro.";
    case "data_passada": return "Escolha a data de hoje ou uma data futura.";
    case "horario_passado": return `O horário de saída${ctx.hora_saida ? " " + ctx.hora_saida : ""} já passou. Escolha um horário a partir de agora.`;
    case "retorno_invalido": return "O horário de retorno precisa ser depois do horário de saída. Se a viagem passa da meia-noite, informe também a data de retorno.";
    case "data_retorno_invalida": return "A data de retorno precisa ser a da saída ou, no máximo, 1 dia depois.";
    case "veiculo_inativo": return `O veículo${v ? " " + v.codigo : ""} está inativo. Escolha outro veículo ou uma categoria.`;
    case "categoria_incompativel": return `O veículo${v ? " " + v.codigo + " é da categoria " + nomeCategoria(v.categoria) + "," : ""} diferente da categoria escolhida. Ajuste um dos dois.`;
    case "veiculo_obrigatorio": return "Escolha um veículo ou uma categoria.";
    case "sem_veiculo_disponivel": return `Não há veículo ${nomeCategoria(ctx.categoria)} livre nesse período. Tente outro horário ou outra categoria.`;
    case "conflito_horario": return `O veículo${v ? " " + v.codigo : ""} já está reservado nesse intervalo. Escolha outro horário, outro veículo ou deixe só a categoria.`;
    case "reservas_incompativeis": return "Não é possível mudar a categoria: há reservas futuras com mais passageiros do que o novo veículo comporta. Cancele ou realoque essas reservas antes.";
    case "required": return "Preencha este campo.";
    case "invalid": return "Valor inválido neste campo.";
    case "invalid_choice": return "Escolha uma opção da lista.";
    case "max_length": return "Texto longo demais para este campo.";
    case "unique": return "Já existe um veículo com este código.";
    case "tipo_invalido":
    case "valor_invalido":
      console.error("Tipo enviado incorretamente pelo front:", campo, item);
      return "Não foi possível enviar os dados. Confira os campos.";
    default: return item.message || "Valor inválido neste campo.";
  }
}

/** Mensagem geral (topo) para erros sem campo, decidida pelo status/código. */
export function textoGeral(erro) {
  switch (erro.codigo) {
    case "sem_permissao":
      return erro.status === 403 && /excluir/i.test(erro.mensagem)
        ? "Somente o COSEG pode excluir reservas. Use Cancelar."
        : /pr[óo]prias/i.test(erro.mensagem)
          ? "Você só pode acessar as suas próprias reservas."
          : "Esta ação é restrita ao COSEG.";
    case "reserva_cancelada": return "Esta reserva foi cancelada e não pode mais ser editada. Faça uma nova reserva.";
    case "ja_cancelada": return "Esta reserva já estava cancelada.";
    case "veiculo_com_reservas": return "Este veículo tem reservas e não pode ser excluído. Desative-o para que não receba novas reservas.";
    case "data_invalida": return "Data inválida. Escolha uma data no calendário.";
    case "nao_encontrado": return "Este registro não existe mais.";
    case "csrf": return "Não foi possível validar sua sessão. Recarregue a página.";
    case "rede": return erro.mensagem;
    default: break;
  }
  if (erro.status === 404) return "Este registro não existe mais.";
  if (erro.status >= 500) return "Não foi possível concluir agora. Tente de novo em instantes.";
  if (erro.status === 429) return "Muitas tentativas. Aguarde alguns minutos para tentar de novo.";
  return erro.mensagem || "Não foi possível concluir agora. Tente de novo em instantes.";
}
