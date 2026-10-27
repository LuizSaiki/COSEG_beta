import hashlib
import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError

USUARIOS = [
    # (username, nome, sobrenome, is_staff)
    ("coseg", "Carla", "Mendes", True),
    ("colaborador", "Ana", "Ribeiro", False),
    ("colaborador2", "Diego", "Martins", False),
]


class Command(BaseCommand):
    help = "Cria/atualiza os usuários de demonstração (senha em COSEG_SENHA_TESTE no .env)"

    def handle(self, *args, **opts):
        senha = os.environ.get("COSEG_SENHA_TESTE", "")
        if not senha:
            raise CommandError(
                "Defina COSEG_SENHA_TESTE no arquivo .env (veja .env.example) antes de rodar."
            )
        User = get_user_model()
        for username, nome, sobrenome, staff in USUARIOS:
            usuario, criado = User.objects.get_or_create(username=username)
            usuario.first_name, usuario.last_name = nome, sobrenome
            usuario.is_staff = staff
            usuario.is_active = True
            if os.environ.get("VERCEL"):
                # Cada instância do Vercel recria o banco. Com sal aleatório o hash da senha
                # muda por instância e o Django derruba a sessão (o hash entra na sessão).
                # Sal fixo, derivado da SECRET_KEY, deixa o hash igual em todas.
                sal = hashlib.sha256(f"{settings.SECRET_KEY}:{username}".encode()).hexdigest()[:22]
                usuario.password = make_password(senha, salt=sal)
            else:
                usuario.set_password(senha)
            usuario.save()
            self.stdout.write(f"{'Criado' if criado else 'Atualizado'}: {username} ({nome} {sobrenome})")
        self.stdout.write(self.style.SUCCESS("Usuários de teste prontos."))
