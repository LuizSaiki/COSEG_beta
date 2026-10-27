# COSEG Mobilidade — Requisitos e Regras de Negócio (Front-end, PBL 2)

Projeto: interface web do sistema "COSEG Mobilidade — Reserva de Veículos" (Porto do Itaqui), integrada ao back-end Django do PBL 1.

**Fontes (únicas usadas):**

- **[ENUN]** Enunciado do PBL 2 (`PBL 2 - COSEG - Aluno.pdf`), seções 1 e 2.
- **[BE]** Back-end em `reservas/` e `config/`. Referências no formato `arquivo:linha`.

Tudo o que não tem fonte está em "Pendências" (seção 9). Nenhum critério de aceite depende de item pendente.

---

## 1. Contexto

- O setor COSEG gerencia os veículos do Porto do Itaqui. A frota do enunciado tem **8 veículos leves de 4 lugares** e **2 coletivos de 18 lugares** [ENUN].
- Os pedidos chegam por telefone, mensagem, e-mail ou presencialmente, anotados em planilhas e agendas, sem padrão único [ENUN].
- Problemas relatados no enunciado: (1) duas equipes esperando o mesmo veículo; (2) veículo de 4 lugares pedido para 7 pessoas, só percebido na saída; (3) horário de retorno ignorado, causando sobreposição. Conclusão do enunciado: é preciso controlar **todo o intervalo de uso**, não só a saída.
- Objetivo do PBL 2: interface em HTML, CSS e JavaScript que consome o back-end, orienta o usuário, reduz erros e mantém **o servidor como fonte de verdade** [ENUN].

## 2. Perfis

| Perfil | Como o back-end identifica | O que pode | Fonte |
|---|---|---|---|
| Colaborador (usuário comum) | usuário autenticado com `is_staff = False` | Listar, ver, editar e cancelar **somente as reservas que criou**. Criar reservas. Ver a frota e consultar disponibilidade. Não exclui reservas e não altera veículos. | `views.py:270-271` (lista filtrada por `criado_por`), `views.py:151-154` (403 em reserva alheia), `views.py:333-334` (excluir só COSEG), `views.py:145-148` (veículos só COSEG) |
| COSEG | `is_staff = True` (o login devolve `usuario.coseg`) | Tudo do colaborador, sobre **todas** as reservas. Exclui reservas. Cadastra, edita, desativa e exclui veículos. | `views.py:151-152`, `views.py:270`, `views.py:333`, `views.py:145-148`, `views.py:190` |

Observações:

- Os perfis vêm do back-end. O enunciado cita o COSEG como setor responsável pela frota, mas não define perfis nem login (ver P02).
- Todos os endpoints, exceto `/api/csrf/`, `/api/login/` e `/api/logout/`, exigem sessão autenticada (`seguranca.py:6-17`).
- Esconder botões por perfil no front é só orientação. Quem decide é o servidor (403).

## 3. Convenções de integração

- Base: `/api/` (`config/urls.py:22`). Rotas em `reservas/urls.py:4-15`.
- Corpo em JSON. Datas `AAAA-MM-DD`, horas `HH:MM`.
- **CSRF:** buscar o token em `GET /api/csrf/` (`views.py:163-166`) e enviar `X-CSRFToken` em todo POST/PUT/PATCH/DELETE, inclusive no login. Falha devolve 403 com `codigo: "csrf"` (`views.py:158-160`, `settings.py:138`).
- **Sessão por cookie** (`SESSION_COOKIE_SAMESITE = "Lax"`, `settings.py:134-136`). O settings não tem CORS, então o front deve ser servido na mesma origem do Django (ver P04).
- Resposta de reserva (`views.py:108-119`): `id, solicitante, setor, atividade, origem, destino, data, hora_saida, data_retorno, hora_retorno, passageiros, veiculo{id,codigo,categoria,capacidade,ativo}, categoria_pretendida, observacoes, status (ATIVA|CANCELADA), criado_por`.
- Na resposta, `data_retorno` vem **sempre preenchida** (igual a `data` quando o retorno é no mesmo dia). Na entrada, `data_retorno` vazia significa retorno no mesmo dia (`models.py:84`, `views.py:113`).

## 4. Requisitos funcionais (RF)

Legenda de perfil: **C** = colaborador, **S** = COSEG (staff), **C+S** = ambos.

### RF01 — Login e sessão
- **Descrição:** tela de login com usuário e senha. Após o sucesso, o front guarda o perfil (`coseg`) e libera as telas conforme o perfil. Ao abrir o app, `GET /api/eu/` diz se já há sessão.
- **Endpoints:** `GET /api/csrf/`, `POST /api/login/` (`{username, password}`), `GET /api/eu/`.
- **Perfil:** C+S.
- **Critérios de aceite:**
  - Dado um usuário válido, quando enviar usuário e senha corretos, então o servidor responde 200 com `usuario.coseg` e o front abre a tela inicial do perfil.
  - Dado credenciais erradas, quando o servidor responder 401, então o front mostra "Usuário ou senha incorretos" e mantém o usuário na tela de login.
  - Dado o limite de tentativas excedido, quando o servidor responder 429, então o front mostra a mensagem da RN16 e desabilita o botão de entrar por alguns segundos.
  - Dado qualquer tela protegida, quando o servidor responder 401, então o front volta ao login.
- **Fonte:** `views.py:169-202`, `seguranca.py:6-17`. Login não consta no enunciado (P02).

### RF02 — Logout
- **Descrição:** botão "Sair" que encerra a sessão.
- **Endpoint:** `POST /api/logout/`.
- **Perfil:** C+S.
- **Critério:** Dado um usuário logado, quando clicar em "Sair" e o servidor responder 200, então o front limpa o perfil em memória e mostra o login. Uma chamada seguinte a `/api/eu/` deve responder 401.
- **Fonte:** `views.py:193-196`.

### RF03 — Painel do dia (COSEG)
- **Descrição:** visão das reservas de uma data (padrão: hoje), agrupadas por veículo, com horário de saída e retorno, destino e status. É a tela inicial do COSEG.
- **Endpoint:** `GET /api/reservas/?data=AAAA-MM-DD` (também aceita `veiculo=<codigo>`).
- **Perfil:** S. O colaborador que chamar o mesmo endpoint só recebe as próprias reservas.
- **Critérios de aceite:**
  - Dado um COSEG logado, quando abrir o painel, então o front consulta `/api/reservas/?data=<hoje>` e lista as reservas retornadas, ordenadas por `hora_saida`.
  - Dado que a data do filtro foi alterada, quando o servidor responder 200, então a lista é substituída apenas após a resposta.
  - Dado que o servidor responder 400 com `codigo: "data_invalida"`, quando o painel renderizar o erro, então mostra "Data inválida. Escolha uma data no calendário".
  - Dado uma data sem reservas, então o painel mostra o estado vazio "Nenhuma reserva nesta data".
- **Fonte:** `views.py:267-279`. O painel como tela não é pedido no enunciado (P01).

### RF04 — Visualização da frota
- **Descrição:** lista de veículos com código, categoria, capacidade e situação (ativo/inativo). Disponível a todos os perfis.
- **Endpoint:** `GET /api/veiculos/` (e `GET /api/veiculos/{id}/` para detalhe).
- **Perfil:** C+S.
- **Critérios de aceite:**
  - Dado um usuário logado, quando abrir "Frota", então o front lista todos os veículos devolvidos, mostrando categoria (Leve ou Coletivo), capacidade e "Inativo" quando `ativo = false`.
  - Dado um colaborador, quando abrir a frota, então não vê botões de cadastro, edição ou exclusão.
- **Fonte:** [ENUN] "Visualização da frota disponibilizada pelo backend"; `views.py:206-210`, `views.py:103-105`.

### RF05 — Lista de reservas com filtros
- **Descrição:** tabela/cartões de reservas. O colaborador vê as suas, o COSEG vê todas. Filtros pelo servidor: `data` e `veiculo` (código). Filtro por status (Ativa/Cancelada) feito no front sobre os dados já recebidos, pois o servidor não filtra por status (P08).
- **Endpoint:** `GET /api/reservas/?data=&veiculo=`.
- **Perfil:** C+S.
- **Critérios de aceite:**
  - Dado um colaborador, quando listar reservas, então só aparecem reservas com `criado_por` igual ao seu usuário.
  - Dado um COSEG, quando listar sem filtro, então aparecem as reservas de todos os usuários.
  - Dado o filtro de data e de veículo preenchidos, quando aplicar, então o front envia `data` e `veiculo` na query e mostra o resultado devolvido.
  - Dado uma reserva `CANCELADA`, então o item exibe o selo "Cancelada" e não oferece "Editar" nem "Cancelar".
- **Fonte:** [ENUN] "visualizar registros existentes"; `views.py:267-279`.

### RF06 — Nova reserva
- **Descrição:** formulário com solicitante, setor, atividade, origem, destino, data, hora de saída, data de retorno (opcional, para viagem que passa da meia-noite), hora de retorno, passageiros, veículo **ou** categoria pretendida e observações. O front envia e só atualiza a tela depois da resposta.
- **Endpoint:** `POST /api/reservas/`.
- **Perfil:** C+S.
- **Critérios de aceite:**
  - Dado um formulário válido, quando enviar e o servidor responder 201, então o front mostra "Reserva registrada com sucesso", exibe o veículo atribuído (`reserva.veiculo.codigo`) e atualiza a lista.
  - Dado que a resposta traga `avisos` não vazio, então o front mostra cada aviso em destaque amarelo, sem bloquear (ver seção 6).
  - Dado qualquer 400 ou 409 com `erros`, então o front mantém os dados digitados e marca cada campo citado em `erros` com a mensagem da seção 5.
  - Dado que o usuário informou só a categoria, quando o servidor responder 201, então o front exibe qual veículo foi atribuído.
  - Dado que o usuário não escolheu veículo nem categoria, quando enviar, então a mensagem da RN10 aparece no formulário (resposta do servidor ou orientação do front, ver seção 5.2).
- **Fonte:** [ENUN] seção 2 (formulário e "atualizar a tela somente após a resposta do servidor"); `views.py:281-299`, `forms.py:14-62`.

### RF07 — Consulta de disponibilidade
- **Descrição:** no formulário, o usuário consulta quais veículos estão livres para data, horários, passageiros e (opcional) categoria. Serve de orientação para escolher; a reserva continua sendo validada pelo servidor.
- **Endpoint:** `GET /api/disponibilidade/?data=&saida=&retorno=&passageiros=&data_retorno=&categoria=`.
- **Perfil:** C+S.
- **Critérios de aceite:**
  - Dado data, saída, retorno e passageiros válidos, quando consultar, então o front lista os veículos de `disponiveis`, do menor para o maior (ordem do servidor).
  - Dado `disponiveis` vazio, então o front mostra "Nenhum veículo disponível nesse período. Tente outro horário".
  - Dado 400 com `erros`, então os erros são mapeados para os campos `data`, `saida`, `retorno`, `data_retorno`, `passageiros` e `categoria` (atenção: aqui os nomes são `saida` e `retorno`, não `hora_saida`/`hora_retorno`).
- **Fonte:** `views.py:354-390`, `services.py:91-104`. Consulta de disponibilidade não é item literal do enunciado; apoia "reduzir erros" e "ajudar na escolha da categoria" [ENUN].

### RF08 — Editar reserva
- **Descrição:** abrir a reserva (`GET /api/reservas/{id}/`), alterar e salvar. O front envia só os campos alterados (PATCH) ou todos (PUT); o que não é enviado permanece.
- **Endpoints:** `GET /api/reservas/{id}/`, `PATCH|PUT /api/reservas/{id}/`.
- **Perfil:** C (só as próprias) e S (todas).
- **Critérios de aceite:**
  - Dado uma reserva ativa própria, quando salvar alterações válidas e o servidor responder 200, então o front mostra "Reserva atualizada" e atualiza o item.
  - Dado uma reserva `CANCELADA`, quando tentar editar, então o servidor responde 409 (`reserva_cancelada`) e o front mostra a mensagem da RN12. O botão "Editar" não deve aparecer para reservas canceladas.
  - Dado um colaborador, quando abrir reserva de outro usuário, então o servidor responde 403 e o front mostra a mensagem da seção 7.
  - Dado que as regras de conflito falhem na edição, então vale o mesmo tratamento do RF06.
- **Fonte:** `views.py:304-331`, `views.py:122-136`.
- **Armadilhas do merge (para integração):** (a) `data_retorno` não enviada mantém o valor anterior; para voltar ao mesmo dia, enviar `""`. (b) Enviar `veiculo` sem `categoria_pretendida` zera a categoria. (c) Enviar só `categoria_pretendida` mantém o veículo atual e checa compatibilidade; para pedir nova atribuição automática, enviar `veiculo: ""` junto com a categoria (inferido do código em `views.py:122-136` e `forms.py:34-61`; confirmar em teste de integração).

### RF09 — Cancelar reserva
- **Descrição:** ação "Cancelar" com confirmação. Libera o veículo; a reserva permanece no histórico com status `CANCELADA`.
- **Endpoint:** `POST /api/reservas/{id}/cancelar/`.
- **Perfil:** C (só as próprias) e S (todas).
- **Critérios de aceite:**
  - Dado uma reserva ativa, quando o usuário confirmar e o servidor responder 200, então o item passa a "Cancelada" e o front mostra "Reserva cancelada. O veículo foi liberado".
  - Dado uma reserva já cancelada, quando o servidor responder 409 (`ja_cancelada`), então o front mostra "Esta reserva já estava cancelada" e recarrega o item.
  - Dado um colaborador, quando cancelar reserva de outro usuário, então 403 e mensagem da seção 7.
- **Fonte:** `views.py:339-350`, `models.py:124-128`.

### RF10 — Excluir reserva (COSEG)
- **Descrição:** exclusão definitiva, com confirmação. Disponível só ao COSEG; o colaborador usa "Cancelar".
- **Endpoint:** `DELETE /api/reservas/{id}/`.
- **Perfil:** S.
- **Critérios de aceite:**
  - Dado um COSEG, quando confirmar a exclusão e o servidor responder 200, então a reserva sai da lista e o front mostra "Reserva excluída".
  - Dado um colaborador (por qualquer meio), quando o servidor responder 403 `sem_permissao`, então o front mostra "Somente o COSEG pode excluir reservas. Use Cancelar" e nada é removido da tela.
  - Dado um colaborador, então o botão "Excluir" não é exibido.
- **Fonte:** `views.py:333-336`; [ENUN] "excluir reservas".

### RF11 — Cadastrar veículo (COSEG)
- **Descrição:** formulário com código, categoria (LEVE ou COLETIVO) e ativo. A capacidade é derivada da categoria pelo servidor (4 ou 18) e **não é enviada**.
- **Endpoint:** `POST /api/veiculos/`.
- **Perfil:** S.
- **Critérios de aceite:**
  - Dado dados válidos, quando o servidor responder 201, então o veículo aparece na frota com a capacidade devolvida.
  - Dado um código já existente ou categoria inválida, quando o servidor responder 400, então os erros aparecem nos campos `codigo` e `categoria`.
  - Dado um colaborador, quando o servidor responder 403, então o front mostra a mensagem da seção 7.
- **Fonte:** `views.py:206-229`, `models.py:29-66`, `forms.py:8-11`.

### RF12 — Editar e desativar veículo (COSEG)
- **Descrição:** editar código e categoria; desativar/reativar pela flag `ativo`. Veículo inativo continua listado, mas não recebe novas reservas (RN08).
- **Endpoint:** `PATCH|PUT /api/veiculos/{id}/`.
- **Perfil:** S.
- **Critérios de aceite:**
  - Dado um veículo ativo, quando o COSEG desativar e o servidor responder 200, então a frota mostra "Inativo".
  - Dado uma mudança de categoria que deixe reservas futuras ativas com mais passageiros que a nova capacidade, quando o servidor responder 400 com `code: "reservas_incompativeis"`, então o front mostra a mensagem da RN17 e mantém a categoria anterior.
- **Fonte:** `views.py:232-256`, `models.py:39-57`.

### RF13 — Excluir veículo (COSEG)
- **Descrição:** exclusão só é possível para veículo sem reservas; com reservas, orientar a desativar.
- **Endpoint:** `DELETE /api/veiculos/{id}/`.
- **Perfil:** S.
- **Critérios de aceite:**
  - Dado um veículo sem reservas, quando o servidor responder 200, então ele sai da frota.
  - Dado um veículo com reservas, quando o servidor responder 409 `veiculo_com_reservas`, então o front mostra a mensagem da RN15 e oferece "Desativar".
- **Fonte:** `views.py:257-261`, `models.py:88` (`on_delete=PROTECT`).

### RF14 — Feedback ao usuário (transversal)
- **Descrição:** toda resposta do servidor (sucesso, aviso ou erro) vira mensagem visível, em linguagem simples, junto ao campo quando houver `erros[campo]`, ou em um aviso geral quando não houver.
- **Critérios de aceite:**
  - Dado qualquer resposta com `sucesso: true`, então o front mostra a `mensagem` de sucesso (ou a versão ajustada) em área com `role="status"`.
  - Dado qualquer resposta de erro, então a mensagem aparece em área com `role="alert"` e o foco vai ao primeiro campo com erro.
  - Dado falha de rede ou resposta não JSON, então o front mostra "Não foi possível falar com o servidor. Verifique a conexão e tente de novo" e mantém os dados digitados.
- **Fonte:** [ENUN] "Exibição clara das mensagens de erro, validação ou sucesso retornadas pelo backend". Os papéis ARIA são decisão de acessibilidade do front, não do enunciado.

## 5. Regras de negócio (RN) validadas no servidor

O servidor é a fonte de verdade. O front **não reimplementa** estas regras [ENUN]; apenas orienta antes do envio (coluna "Orientação no front") e exibe a resposta.

### 5.1 Tabela de regras

Mensagens do front: sem "por favor" e sem ponto de exclamação. Trechos entre chaves são preenchidos com dados que o próprio front já tem (formulário ou lista de veículos). O front **não deve extrair texto da mensagem do servidor**; deve decidir pelo `code`.

| RN | Regra | Campo / `code` | HTTP | Mensagem original do servidor | Mensagem ao usuário | Orientação no front | Fonte |
|---|---|---|---|---|---|---|---|
| RN01 | Capacidade por categoria: LEVE comporta 4 e COLETIVO 18 | `passageiros` / `capacidade_excedida` (categoria, sem veículo) | 400 | "A categoria {cat} comporta {n} passageiros. Escolha a categoria COLETIVO." | "A categoria Leve comporta até 4 passageiros. Para {pax} pessoas, escolha Coletivo." | Mostrar a capacidade ao escolher categoria/veículo e avisar ao digitar passageiros acima dela | `services.py:8`, `models.py:210-213` |
| RN02 | Capacidade do veículo escolhido | `passageiros` / `capacidade_excedida` (veículo) | 400 | "O veículo {codigo} comporta {n} passageiros e foram solicitados {pax}." | "O veículo {codigo} comporta {n} passageiros e você informou {pax}. Escolha um veículo de maior capacidade." | Idem RN01; `max` do campo conforme veículo | `models.py:206-209` |
| RN03 | Máximo absoluto de 18 passageiros | `passageiros` / `acima_do_limite` | 400 | "Solicitação rejeitada: o máximo é 18 passageiros." | "O máximo é de 18 passageiros por reserva." | `max="18"` no campo | `services.py:9`, `models.py:202-204` |
| RN04 | Mínimo de 1 passageiro | `passageiros` / `passageiros_invalido` | 400 | "Informe ao menos 1 passageiro." | "Informe ao menos 1 passageiro." | `min="1"` | `models.py:200-201` |
| RN05 | Data não pode estar no passado | `data` / `data_passada` | 400 | "A data não pode estar no passado." | "Escolha a data de hoje ou uma data futura." | `min` = hoje (ver P12: modo demonstração) | `services.py:34-35` |
| RN06 | Se a saída é hoje, o horário não pode já ter passado | `hora_saida` / `horario_passado` | 400 | "O horário de saída (HH:MM) já passou hoje." | "O horário de saída {HH:MM} já passou. Escolha um horário a partir de agora." | Comparar com o relógio do cliente só como dica (ver P14) | `services.py:36-41` |
| RN07 | Retorno posterior à saída | `hora_retorno` / `retorno_invalido` | 400 | "O horário de retorno deve ser posterior ao de saída." (sem `data_retorno`, acrescenta: "Para viagens que passam da meia-noite, informe também a data_retorno.") | "O horário de retorno precisa ser depois do horário de saída. Se a viagem passa da meia-noite, informe também a data de retorno." | Comparar hora quando `data_retorno` vazia | `services.py:54-60` |
| RN07b | `data_retorno` não pode ser anterior à data | `data_retorno` / `data_retorno_invalida` | 400 | "A data de retorno não pode ser anterior à data de saída." | "A data de retorno não pode ser antes da data de saída." | `min` = data de saída | `services.py:44-48` |
| RN07c | `data_retorno` no máximo 1 dia após a saída | `data_retorno` / `data_retorno_invalida` | 400 | "O retorno pode ocorrer, no máximo, 1 dia após a saída." | "O retorno pode ser, no máximo, 1 dia depois da saída." | `max` = data de saída + 1 dia | `services.py:10`, `services.py:49-52` |
| RN08 | Veículo inativo não recebe reserva (criar ou mudar agenda; editar só observações é permitido) | `veiculo` / `veiculo_inativo` | 400 | "O veículo {codigo} está inativo e não pode receber reservas." | "O veículo {codigo} está inativo. Escolha outro veículo ou uma categoria." | Não listar inativos como opção de escolha | `models.py:219-222` |
| RN09 | Categoria pretendida compatível com o veículo escolhido | `categoria_pretendida` / `categoria_incompativel` | 400 | "O veículo {codigo} é da categoria {cat}, mas a categoria pretendida é {cat2}." | "O veículo {codigo} é da categoria {Leve ou Coletivo}, diferente da categoria escolhida. Ajuste um dos dois." | Ao escolher veículo, preencher/travar a categoria | `models.py:214-217` |
| RN10 | Informar veículo **ou** categoria | `__all__` / `veiculo_obrigatorio` | 400 | "Informe o veículo ou a categoria pretendida." | "Escolha um veículo ou uma categoria." | Exigir um dos dois antes de enviar | `forms.py:34-37` |
| RN11 | Atribuição automática: só categoria informada, o servidor escolhe o **menor** veículo livre (ordem capacidade, código) | sucesso 201; sem veículo livre: `categoria_pretendida` / `sem_veiculo_disponivel` | 409 | "Nenhum veículo dessa categoria está disponível no período." | "Não há veículo {Leve ou Coletivo} livre nesse período. Tente outro horário ou outra categoria." | Texto de apoio "O sistema escolhe o veículo livre"; consulta opcional via RF07 | `forms.py:39-61`, `services.py:104` |
| RN12 | Reserva cancelada não pode ser editada | `codigo: reserva_cancelada` | 409 | "Reserva cancelada não pode ser editada." | "Esta reserva foi cancelada e não pode mais ser editada. Faça uma nova reserva." | Ocultar "Editar" em canceladas | `views.py:314-315`, `models.py:172-174` |
| RN13 | Conflito de intervalo por veículo: duas reservas ativas do mesmo veículo não podem se sobrepor. Encostar (fim = início) **não** é conflito | `veiculo` / `conflito_horario` | 409 | "Conflito: {codigo} já está reservado nesse intervalo (reserva #id de {codigo} (dd/mm/aaaa HH:MM até dd/mm/aaaa HH:MM))." | "O veículo {codigo} já está reservado nesse intervalo. Escolha outro horário, outro veículo ou deixe só a categoria." | Nenhuma validação local; no máximo RF07 como consulta | `services.py:79-83`, `models.py:224-238` |
| RN14 | Cancelar é sempre permitido (sem revalidar regras); só falha se já estiver cancelada | `codigo: ja_cancelada` | 409 | "Esta reserva já está cancelada." | "Esta reserva já estava cancelada." | Confirmar antes de cancelar | `models.py:124-128`, `views.py:346-349` |
| RN15 | Veículo com reservas não pode ser excluído, só desativado | `codigo: veiculo_com_reservas` | 409 | "Veículo possui reservas; desative-o em vez de excluir." | "Este veículo tem reservas e não pode ser excluído. Desative-o para que não receba novas reservas." | Oferecer "Desativar" | `views.py:259-260`, `models.py:88` |
| RN16 | Login: limite de 5 tentativas erradas por IP + usuário, bloqueio de 300 s | sem `code`; HTTP decide | 429 (bloqueado), 401 (credencial errada) | "Muitas tentativas de login. Aguarde alguns minutos." / "Usuário ou senha inválidos." | "Muitas tentativas de login. Aguarde 5 minutos para tentar de novo." / "Usuário ou senha incorretos." | Nenhuma | `views.py:21-22`, `views.py:177-185` |
| RN17 | Mudar a categoria do veículo não pode deixar reservas futuras ativas acima da nova capacidade | `categoria` / `reservas_incompativeis` | 400 | "Não é possível mudar para {cat} (capacidade {n}): há reservas futuras com mais passageiros: #id (...). Cancele ou realoque antes." | "Não é possível mudar a categoria: há reservas futuras com mais passageiros do que o novo veículo comporta. Cancele ou realoque essas reservas antes." | Nenhuma | `models.py:39-57` |
| RN18 | Permissão por dono: colaborador só acessa reserva própria; só COSEG exclui reserva e altera veículos | `codigo: sem_permissao` | 403 | "Você só pode acessar as suas próprias reservas." / "Somente o COSEG exclui reservas. Use /cancelar/." / "Acesso restrito ao COSEG." | "Você só pode acessar as suas próprias reservas." / "Somente o COSEG pode excluir reservas. Use Cancelar." / "Esta ação é restrita ao COSEG." | Ocultar ações por perfil | `views.py:145-154`, `views.py:333-334` |
| RN19 | Editar: checagem de data/hora passada só se data ou saída mudou; checagem de conflito só se veículo ou agenda mudou | (mesmos códigos de RN05, RN06, RN13) | 400/409 | (mesmas) | (mesmas) | Não bloquear edição de observações em reserva cujo horário já passou | `models.py:182-188`, `models.py:225-230` |

Notas:

- **Status 409 prevalece** sobre 400 quando a resposta contém `conflito_horario` ou `sem_veiculo_disponivel` (`views.py:23`, `views.py:92-96`).
- A mensagem do servidor para RN13 e RN17 cita ids e horários de outras reservas. Não exibir como está para colaborador sem decisão do time (P06).
- Para campos obrigatórios vazios, formato inválido ou escolha inválida, o servidor devolve mensagens padrão do Django em pt-br (codes `required`, `invalid`, `invalid_choice`, `max_length`, `unique`). Elas não estão no código do projeto (P10). Mensagens sugeridas ao usuário: "Preencha este campo", "Valor inválido neste campo", "Escolha uma opção da lista", "Use no máximo {n} caracteres", "Já existe um veículo com este código".
- Erros de tipo: `tipo_invalido` e `valor_invalido` (400, `views.py:49-79`) indicam bug do front (tipo enviado errado). Mostrar a mensagem geral "Não foi possível enviar os dados. Confira os campos" e registrar no console.

### 5.2 Validações de experiência no front (orientação apenas)

O enunciado pede "validações de experiência, sem substituir as do servidor" e "validação da capacidade, da data e dos horários" [ENUN]. O front pode, **sem impedir o envio quando houver dúvida**:

| Orientação | Base (regra do servidor) |
|---|---|
| Campos obrigatórios marcados: solicitante, setor, atividade, origem, destino, data, hora de saída, hora de retorno, passageiros e veículo ou categoria | `models.py:77-87`, RN10 |
| Limites de tamanho: solicitante 120, setor 80, atividade 120, origem 120, destino 120 | `models.py:77-81` |
| Passageiros entre 1 e 18; mostrar a capacidade do veículo ou categoria escolhida (4 ou 18) | RN01 a RN04 |
| Data mínima = hoje; hora de saída futura se for hoje | RN05, RN06 |
| Retorno depois da saída; `data_retorno` entre a data e a data + 1 dia | RN07, RN07b, RN07c |
| Campo "Observações" opcional | `models.py:92` |

Regra de ouro: o servidor sempre revalida. Se o servidor recusar algo que o front aceitou, vale a resposta do servidor. O front não calcula conflito de reservas nem escolhe veículo.

## 6. Avisos não bloqueantes (`avisos`)

- **Onde aparecem:** respostas de sucesso de `POST /api/reservas/` (201) e `PATCH|PUT /api/reservas/{id}/` (200), no campo `avisos` (lista de textos). Podem vir vazios (`views.py:298-299`, `views.py:330-331`).
- **Regra atual (única):** reserva em veículo COLETIVO com **4 passageiros ou menos**. Texto do servidor: "O veículo {codigo} é coletivo ({n} lugares) e a reserva tem apenas {pax} passageiro(s). Um veículo leve atenderia." (`services.py:120-129`).
- **Tratamento no front:** a reserva já foi gravada. Mostrar o sucesso e, abaixo, o aviso em destaque secundário: "Reserva registrada. Atenção: {texto do aviso}". Se o usuário quiser trocar, usa "Editar".
- **Critério de aceite:** Dado `sucesso: true` com `avisos` não vazio, quando a tela renderizar, então mostra o sucesso e cada aviso como alerta não bloqueante, sem impedir a navegação. Dado `avisos` vazio, então nenhum aviso é exibido.

## 7. Formato de erro da API e mapeamento por status

**Formato padrão** (`views.py:42-46`):

```json
{
  "sucesso": false,
  "mensagem": "texto geral",
  "erros": { "campo": [ { "message": "texto", "code": "codigo_do_erro" } ] },
  "codigo": "opcional"
}
```

- `erros` pode ser `{}`. Erros sem campo vêm em `"__all__"` (`views.py:89`, `forms.py:35`).
- `codigo` (topo) só aparece em erros que não são de campo (`sem_permissao`, `csrf`, `veiculo_com_reservas`, `reserva_cancelada`, `ja_cancelada`, `data_invalida`, e os do middleware).
- Chaves de `erros` na reserva/veículo = nomes dos campos do formulário. Na disponibilidade = nomes dos parâmetros (`saida`, `retorno`).
- O middleware converte 404, 405 e 500 sob `/api/` para JSON com `codigo` (`middleware.py:3-33`).

| HTTP | Quando ocorre | O front faz |
|---|---|---|
| 200 / 201 | Sucesso (`sucesso: true`; 201 = criado) | Mostra sucesso, mostra `avisos`, atualiza a tela depois da resposta |
| 400 | Validação (`erros` por campo), JSON inválido (sem `code`), tipos inválidos, `data_invalida` | Marca os campos com a mensagem do `code` (seção 5), mantém dados digitados, foca o primeiro erro |
| 401 | Sem sessão em endpoint protegido (`seguranca.py:11-16`); credencial errada no login (`views.py:185`) | No login: "Usuário ou senha incorretos". Em outras rotas: sessão expirada, volta ao login com "Sua sessão expirou. Entre novamente" |
| 403 | `sem_permissao` (RN18); `csrf` | `sem_permissao`: mensagem da RN18. `csrf`: buscar novo token em `/api/csrf/` e tentar uma vez; se persistir, "Não foi possível validar sua sessão. Recarregue a página" |
| 404 | Recurso inexistente (`nao_encontrado`) | "Este registro não existe mais" e recarrega a lista |
| 405 | Método não permitido | Erro de programação; mensagem geral e log no console |
| 409 | Conflito de horário ou disponibilidade (`conflito_horario`, `sem_veiculo_disponivel`); `reserva_cancelada`; `ja_cancelada`; `veiculo_com_reservas` | Mensagem da RN correspondente; em conflito, sugerir outro horário/veículo/categoria |
| 429 | Limite de login (RN16) | Mensagem da RN16 e botão desabilitado temporariamente |
| 500 / rede | `erro_interno` ou sem resposta | "Não foi possível concluir agora. Tente de novo em instantes" e mantém os dados |

## 8. Requisitos não funcionais (do enunciado)

| RNF | Requisito | Fonte |
|---|---|---|
| RNF01 | HTML semântico (estrutura) | [ENUN] "HTML semântico" |
| RNF02 | CSS e JavaScript em arquivos separados, com separação clara entre estrutura, estilo e comportamento | [ENUN] |
| RNF03 | Interface responsiva (celular, tablet, desktop) | [ENUN] "responsiva" |
| RNF04 | Integração real via requisições HTTP com os endpoints do back-end do PBL 1 (sem dados fictícios na tela) | [ENUN] |
| RNF05 | O servidor é a fonte de verdade; regras críticas não são duplicadas no JavaScript | [ENUN] |
| RNF06 | A tela só é atualizada depois da resposta do servidor (sem atualização otimista) | [ENUN] |
| RNF07 | Mensagens claras de erro, alerta e sucesso a partir das respostas do servidor | [ENUN] |
| RNF08 | Dados legíveis e organizados (frota e reservas) | [ENUN] |
| RNF09 | Entregas a acompanhar: board preenchido, interface funcional, este documento, evidências de responsividade, integração, CRUD e mensagens, e justificativa técnica | [ENUN] seção 2 |

## 9. Pendências (sem fonte; decidir com o professor/equipe)

| # | Pendência | Observação |
|---|---|---|
| P01 | O enunciado não define telas nem navegação. "Painel do dia", filtros e tela de frota são derivados dos endpoints | Validar com o professor se são aceitos como escopo |
| P02 | Enunciado não menciona login, perfis nem permissões; vêm só do back-end | Decidir se há usuários de teste (colaborador e COSEG) e como entregá-los |
| P03 | O enunciado diz que o colaborador "encaminha o pedido ao COSEG", mas o back só tem status `ATIVA` e `CANCELADA` (reserva já nasce confirmada, sem aprovação) | Não criar status "pendente" no front |
| P04 | Onde o front será servido. O settings não tem CORS; CSRF e cookie de sessão exigem mesma origem (ou proxy) | Definir: arquivos estáticos do Django, template ou servidor separado com proxy |
| P05 | Não há endpoint para cadastrar usuário nem trocar senha | Usuários criados fora do front (admin/comando) |
| P06 | Mensagens de conflito (RN13) e de RN17 citam ids e horários de reservas de outras pessoas | Decidir se colaborador vê esse detalhe |
| P07 | O enunciado cita comunicar a demanda a um motorista; o back não tem motorista | Fora do escopo do front |
| P08 | Sem paginação, sem filtro por status/solicitante/setor e sem busca no servidor | Filtro por status será local; confirmar se basta |
| P09 | Desativar veículo com reservas futuras ativas é permitido pelo back, sem aviso | Decidir se o front avisa o COSEG (sem bloquear) |
| P10 | Texto exato das mensagens padrão do Django (`required`, `invalid`, `invalid_choice`, `max_length`, `unique`) não está no código do projeto | Capturar em teste de integração |
| P11 | Critérios de responsividade (breakpoints, dispositivos), acessibilidade e navegadores não são detalhados no enunciado | Definir o mínimo de teste (ex.: larguras de celular e desktop) para a evidência |
| P12 | Modo demonstração `COSEG_PERMITIR_DATA_PASSADA` (`settings.py:148`) desliga a RN05 e a RN06; o front não tem como saber se está ativo | Não bloquear data passada no front, só orientar |
| P13 | Tempo restante do bloqueio de login não vem na resposta 429 (sem `Retry-After`); o cache de tentativas usa o padrão do Django, já que o settings não define `CACHES` | Mensagem fixa de "5 minutos" é baseada em `BLOQUEIO_SEGUNDOS = 300` |
| P14 | "Horário já passou hoje" usa o horário do servidor (fuso America/Fortaleza, `settings.py:111`); o relógio do navegador pode divergir | Orientação local é só dica |
| P15 | O campo "solicitante" é texto livre e independente do usuário logado (`criado_por` é o usuário da sessão) | Decidir se preenche com o nome do usuário por padrão |
| P16 | Comportamento de PUT/PATCH na troca de categoria com atribuição automática (RF08, item c) foi inferido do código | Confirmar em teste de integração |
