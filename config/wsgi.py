"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()

# Vercel (demonstração): cada instância nova começa sem banco em /tmp; cria e popula.
if os.environ.get("VERCEL"):
    from django.conf import settings
    from django.core.management import call_command

    if not os.path.exists(settings.DATABASES["default"]["NAME"]):
        call_command("migrate", interactive=False, verbosity=0)
        call_command("criar_usuarios_teste", verbosity=0)
        call_command("seed_demo", verbosity=0)

app = application
