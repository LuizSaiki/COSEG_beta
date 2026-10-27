import os
import shutil
import tempfile
from io import StringIO
from pathlib import Path
from unittest import mock

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone

from .models import Reserva, Veiculo

NOMES = ["entrar", "painel", "frota", "reservas", "reserva-form"]


def _templates_com_stub(pasta):
    """Templates de teste: independem das páginas reais do front-end."""
    for nome in NOMES:
        (Path(pasta) / f"{nome}.html").write_text(f"<html>{nome}</html>", encoding="utf-8")
    cfg = [dict(settings.TEMPLATES[0])]
    cfg[0]["DIRS"] = [pasta]
    return cfg


class PaginasTests(TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.mkdtemp()
        cls._override = override_settings(TEMPLATES=_templates_com_stub(cls._tmp))
        cls._override.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._override.disable()
        shutil.rmtree(cls._tmp, ignore_errors=True)

    def test_raiz_redireciona_para_entrar(self):
        r = self.client.get("/")
        self.assertRedirects(r, "/entrar/", fetch_redirect_response=False)

    def test_paginas_200_template_e_cookie_csrf(self):
        rotas = {
            "/entrar/": "entrar.html",
            "/painel/": "painel.html",
            "/frota/": "frota.html",
            "/reservas/": "reservas.html",
            "/reservas/nova/": "reserva-form.html",
            "/reservas/7/editar/": "reserva-form.html",
        }
        for url, template in rotas.items():
            with self.subTest(url=url):
                r = self.client.get(url)
                self.assertEqual(r.status_code, 200)
                self.assertTemplateUsed(r, template)
                self.assertIn("csrftoken", r.cookies)

    def test_paginas_so_aceitam_get(self):
        self.assertEqual(self.client.post("/painel/").status_code, 405)

    def test_pagina_nao_exige_login(self):
        self.assertEqual(self.client.get("/painel/").status_code, 200)

    def test_api_nao_foi_afetada(self):
        self.assertEqual(self.client.get("/api/eu/").status_code, 401)


class CommandsDemoTests(TestCase):
    def rodar(self, nome):
        saida = StringIO()
        call_command(nome, stdout=saida)
        return saida.getvalue()

    def test_criar_usuarios_teste(self):
        with mock.patch.dict(os.environ, {"COSEG_SENHA_TESTE": "Senha#Teste-Unica-123"}):
            self.rodar("criar_usuarios_teste")
            self.rodar("criar_usuarios_teste")  # idempotente
        User = get_user_model()
        self.assertEqual(User.objects.count(), 3)
        coseg = User.objects.get(username="coseg")
        self.assertTrue(coseg.is_staff)
        self.assertEqual(coseg.get_full_name(), "Carla Mendes")
        self.assertTrue(coseg.check_password("Senha#Teste-Unica-123"))
        self.assertFalse(User.objects.get(username="colaborador").is_staff)
        self.assertEqual(User.objects.get(username="colaborador2").get_full_name(), "Diego Martins")

    def test_criar_usuarios_teste_sem_senha_falha(self):
        with mock.patch.dict(os.environ, {"COSEG_SENHA_TESTE": ""}):
            with self.assertRaisesMessage(CommandError, "COSEG_SENHA_TESTE"):
                self.rodar("criar_usuarios_teste")

    def test_seed_demo_sem_usuarios_falha(self):
        with self.assertRaisesMessage(CommandError, "criar_usuarios_teste"):
            self.rodar("seed_demo")

    def test_seed_demo(self):
        with mock.patch.dict(os.environ, {"COSEG_SENHA_TESTE": "Senha#Teste-Unica-123"}):
            self.rodar("criar_usuarios_teste")
        self.rodar("seed_demo")
        self.rodar("seed_demo")  # reexecutar substitui as reservas de demonstração
        demo = Reserva.objects.filter(observacoes__startswith="[DEMO]")
        self.assertEqual(demo.count(), 12)
        self.assertEqual(demo.filter(status="CANCELADA").count(), 1)
        self.assertFalse(Veiculo.objects.get(codigo="VL-04").ativo)
        self.assertEqual(Veiculo.objects.count(), 10)
        self.assertEqual(demo.values("criado_por").distinct().count(), 3)
        for r in demo:
            self.assertLessEqual(r.passageiros, r.veiculo.capacidade)
        # sem sobreposição entre reservas ativas do mesmo veículo
        ativas = list(Reserva.objects.filter(status="ATIVA"))
        for i, a in enumerate(ativas):
            for b in ativas[i + 1:]:
                if a.veiculo_id == b.veiculo_id:
                    self.assertFalse(a.inicio < b.fim and b.inicio < a.fim, (a, b))
        agora = timezone.localtime().replace(tzinfo=None)
        self.assertTrue(any(r.inicio <= agora < r.fim for r in demo))  # há em andamento
        self.assertTrue(any(r.fim < agora for r in demo))  # há concluídas
