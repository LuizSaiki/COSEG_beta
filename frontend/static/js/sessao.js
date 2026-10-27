// Sessão: consulta GET eu/ ao abrir cada tela, monta a barra lateral conforme o perfil e trata o "Sair".
import { api } from "./api.js";
import { LOGO, esc, icones, toast, mostrarAvisosGuardados } from "./ui.js";
import { iniciais, primeiroNome, saudacao } from "./dominio.js";

export { saudacao, primeiroNome };

function itemMenu(chave, ativo, href, icone, nome) {
  return `<a href="${href}" class="${chave === ativo ? "on" : ""}"${chave === ativo ? ' aria-current="page"' : ""}><i data-lucide="${icone}"></i><span>${nome}</span></a>`;
}

function montarMenu(usuario, ativo) {
  const coseg = !!usuario.coseg;
  document.getElementById("menu").innerHTML = `
    <div class="marca">${LOGO}<div><b>COSEG</b><small>Mobilidade</small></div></div>
    <button type="button" class="menu-toggle" aria-expanded="false" aria-controls="menu-corpo" aria-label="Abrir menu"><i data-lucide="menu"></i></button>
    <div class="menu-corpo" id="menu-corpo">
      <nav aria-label="Principal">
        <span class="grupo">Operação</span>
        ${coseg ? itemMenu("painel", ativo, "/painel/", "layout-dashboard", "Painel do dia") : ""}
        ${itemMenu("frota", ativo, "/frota/", "car-front", "Frota")}
        ${itemMenu("reservas", ativo, "/reservas/", "calendar-check-2", "Reservas")}
        ${itemMenu("nova", ativo, "/reservas/nova/", "circle-plus", "Nova reserva")}
        ${coseg ? `<span class="grupo">Gestão</span>${itemMenu("gestao", ativo, "/frota/?gestao=1", "sliders-horizontal", "Veículos")}` : ""}
      </nav>
      <div class="eu"><span class="av">${esc(iniciais(usuario.nome || usuario.username))}</span><div><b>${esc(usuario.nome || usuario.username)}</b><span>${coseg ? "COSEG" : "Colaborador"}</span></div><button type="button" class="sair" aria-label="Sair" title="Sair"><i data-lucide="log-out"></i></button></div>
    </div>`;
  const menu = document.getElementById("menu");
  const toggle = menu.querySelector(".menu-toggle");
  toggle.addEventListener("click", () => {
    const aberto = menu.classList.toggle("aberto");
    toggle.setAttribute("aria-expanded", String(aberto));
    toggle.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
  });
  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("aberto")) { toggle.click(); toggle.focus(); }
  });
  menu.querySelector(".sair").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      await api.logout();
      location.assign("/entrar/");
    } catch (erro) {
      e.currentTarget.disabled = false;
      toast("erro", erro.mensagem);
    }
  });
  icones();
}

/**
 * iniciar({ ativo, soCoseg })  ->  usuario {username, nome, coseg}
 * 401 já redireciona para /entrar/?volta=... dentro de api.js.
 */
export async function iniciar({ ativo, soCoseg = false }) {
  const usuario = await api.eu();
  if (soCoseg && !usuario.coseg) {
    location.replace("/reservas/");
    return new Promise(() => {});
  }
  montarMenu(usuario, ativo);
  mostrarAvisosGuardados();
  return usuario;
}
