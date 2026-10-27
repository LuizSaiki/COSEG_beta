"""Páginas do front-end (HTML/CSS/JS puros) servidas na mesma origem da API.

Só GET. Não exigem login: a proteção das telas é feita no front (a API responde 401).
O cookie csrftoken é garantido aqui para o JS enviar o X-CSRFToken nas mutações.
"""
from django.shortcuts import redirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.generic import TemplateView


@method_decorator(ensure_csrf_cookie, name="dispatch")
class Pagina(TemplateView):
    http_method_names = ["get"]


def inicio(request):
    return redirect("/entrar/")


entrar = Pagina.as_view(template_name="entrar.html")
painel = Pagina.as_view(template_name="painel.html")
frota = Pagina.as_view(template_name="frota.html")
reservas = Pagina.as_view(template_name="reservas.html")
reserva_nova = Pagina.as_view(template_name="reserva-form.html")
reserva_editar = Pagina.as_view(template_name="reserva-form.html")
