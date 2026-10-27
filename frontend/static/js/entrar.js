import { api } from "./api.js";
import { LOGO, icones } from "./ui.js";

const form = document.getElementById("form-entrar");
const botao = document.getElementById("botao");
const aviso = document.getElementById("aviso");
document.getElementById("marca").insertAdjacentHTML("afterbegin", LOGO);

const params = new URLSearchParams(location.search);

// só aceita caminho interno do próprio site (evita redirecionamento aberto)
// valida a URL já resolvida pelo navegador: "/\site.com" e "/%09/site.com" viram outra origem
function destinoSeguro(volta) {
  if (!volta || !volta.startsWith("/")) return null;
  try {
    const url = new URL(volta, location.origin);
    if (url.origin !== location.origin || url.pathname.startsWith("/entrar")) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
const destino = (usuario) => destinoSeguro(params.get("volta")) || (usuario.coseg ? "/painel/" : "/reservas/");

function mostrarAviso(titulo, texto, info = false) {
  aviso.hidden = false;
  aviso.classList.toggle("info", info);
  aviso.setAttribute("role", info ? "status" : "alert");
  document.getElementById("aviso-titulo").textContent = titulo;
  document.getElementById("aviso-texto").textContent = texto;
}

if (params.get("expirou")) mostrarAviso("Sua sessão expirou", "Entre novamente para continuar.", true);

let bloqueio = null;
function bloquear(segundos) {
  let restante = segundos;
  botao.disabled = true;
  const atualizar = () => { botao.textContent = restante > 0 ? `Aguarde ${restante}s` : "Entrar"; };
  atualizar();
  bloqueio = setInterval(() => {
    restante -= 1;
    atualizar();
    if (restante <= 0) { clearInterval(bloqueio); botao.disabled = false; }
  }, 1000);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  aviso.hidden = true;
  const usuario = form.username.value.trim();
  const senha = form.password.value;
  if (!usuario || !senha) {
    mostrarAviso("Preencha usuário e senha", "Os dois campos são obrigatórios.");
    (usuario ? form.password : form.username).focus();
    return;
  }
  botao.disabled = true;
  botao.setAttribute("aria-busy", "true");
  botao.textContent = "Entrando…";
  try {
    const r = await api.login(usuario, senha);
    location.assign(destino(r.usuario));
  } catch (erro) {
    botao.removeAttribute("aria-busy");
    botao.textContent = "Entrar";
    botao.disabled = false;
    if (erro.status === 401) {
      mostrarAviso("Não foi possível entrar", "Usuário ou senha incorretos.");
      form.password.select();
    } else if (erro.status === 429) {
      mostrarAviso("Muitas tentativas", "Muitas tentativas de login. Aguarde 5 minutos para tentar de novo.");
      bloquear(15);
    } else {
      mostrarAviso("Não foi possível entrar", erro.mensagem);
    }
  }
});
icones();
