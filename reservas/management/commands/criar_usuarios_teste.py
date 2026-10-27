import os

from django.contrib.auth import get_user_model
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
            usuario.set_password(senha)
            usuario.save()
            self.stdout.write(f"{'Criado' if criado else 'Atualizado'}: {username} ({nome} {sobrenome})")
        self.stdout.write(self.style.SUCCESS("Usuários de teste prontos."))
