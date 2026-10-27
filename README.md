# COSEG Mobilidade

Reserva de veículos do porto. Back-end Django (API JSON em `/api/`) e front-end em HTML/CSS/JS
puros, servidos pelo próprio Django na mesma origem (sem CORS).

## Instalação

O `requirements.txt` está em UTF-16, então o pip precisa de ajuda no Windows (PowerShell):

```powershell
python -m venv .venv
Get-Content requirements.txt | Set-Content -Encoding utf8 requirements-utf8.txt
.\.venv\Scripts\python -m pip install -r requirements-utf8.txt
Remove-Item requirements-utf8.txt
Copy-Item .env.example .env   # preencha DJANGO_SECRET_KEY e COSEG_SENHA_TESTE
```

## Rodando

```powershell
.\.venv\Scripts\python manage.py migrate
.\.venv\Scripts\python manage.py seed_dados            # frota VL-01..08 e VC-01..02
.\.venv\Scripts\python manage.py criar_usuarios_teste  # coseg, colaborador, colaborador2
.\.venv\Scripts\python manage.py seed_demo             # reservas de demonstração (relativas a hoje)
.\.venv\Scripts\python manage.py runserver
```

Abra http://127.0.0.1:8000/ (redireciona para a tela de login).

- Usuários de teste: `coseg` (equipe COSEG, staff), `colaborador` e `colaborador2`.
  A senha é a definida em `COSEG_SENHA_TESTE` no `.env`.
- `seed_demo` pode ser reexecutado quando quiser: ele recria só as reservas marcadas com `[DEMO]`
  e deixa o veículo VL-04 inativo.

## Estrutura do front-end

- `frontend/paginas/*.html`: páginas (templates do Django).
- `frontend/static/`: `css/`, `js/`, `img/`.
- Rotas: `/entrar/`, `/painel/`, `/frota/`, `/reservas/`, `/reservas/nova/`, `/reservas/<id>/editar/`.

## Testes

```powershell
.\.venv\Scripts\python manage.py test
```

## Demonstração no Vercel

Publicado em https://coseg-mobilidade.vercel.app (modo demonstração).

- O Vercel roda o Django como função serverless (`vercel.json` → `config/wsgi.py`).
- Não há banco persistente: cada instância cria um SQLite em `/tmp` e roda `migrate`,
  `criar_usuarios_teste` e `seed_demo` ao iniciar. **Reservas criadas na demonstração
  somem quando a instância reinicia.** A sessão vai num cookie assinado.
- Variáveis de produção no projeto do Vercel: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=False`,
  `DJANGO_ALLOWED_HOSTS=.vercel.app` e `COSEG_SENHA_TESTE`.
- Publicar de novo: `vercel --prod`.
