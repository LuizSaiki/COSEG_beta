# COSEG Mobilidade — Casos de teste e resultado da execução (front-end, PBL 2)

- **Executor:** Luffy (QA, Playwright), em 27/10/2026.
- **Ambiente:** Django local em `http://127.0.0.1:8000` (banco de demonstração, nunca produção). Viewport base 1440x900.
- **Fonte dos critérios:** `docs/requisitos.md` (RF01–RF14, RN01–RN19).
- **Usuários:** `coseg` (gestor), `colaborador`, `colaborador2`. A senha vem do `.env` e não é registrada aqui nem nas capturas.
- **Capturas:** `docs/evidencias/luffy/` (nome do arquivo na coluna "Captura"). Cada captura traz contorno vermelho no ponto verificado.
- **Método:** passos feitos no navegador. Formulários foram preenchidos por script (eventos `input`/`change`) e enviados com clique real no botão. Para ver a responsividade em 768 e 360 px foi usado `iframe srcdoc` (o Django envia `X-Frame-Options: deny`, então a URL direta não abre em iframe); 1440 px é o viewport real.

## Placar

| Total | Passed | Failed |
|---|---|---|
| 41 | 41 | 0 |

Não executados (fora do tempo/sem como provocar com segurança): falha de rede e 500 (RF14), renovação de CSRF (403 `csrf`), RN07b/RN07c (`data_retorno` inválida) no formulário, RN19 (editar só observações em reserva passada), PUT, erro 404 em reserva excluída por outra aba.

## 1. Login e sessão (RF01, RF02, RN16)

| ID | RF/RN | Passos | Esperado | Obtido | Resultado | Captura |
|---|---|---|---|---|---|---|
| CT01 | RF01 | Sem sessão, abrir `/painel/` | Redireciona para `/entrar/?volta=...` | Foi para `/entrar/?volta=%2Fpainel%2F&expirou=1` | Passed | `ct01_painel_sem_sessao_redireciona.png` |
| CT02 | RF01 | Em `/entrar/`, usuário `coseg` + senha errada | 401; "Usuário ou senha incorretos"; permanece no login | Aviso "Não foi possível entrar / Usuário ou senha incorretos."; segue em `/entrar/`; foco no campo senha | Passed | `ct02_login_senha_errada_401.png` |
| CT03 | RF01, RN16 | 6 tentativas erradas com usuário inexistente `luffy_inexistente` (não trava usuário real) | 5 vezes 401; na 6ª, 429 com mensagem da RN16 e botão desabilitado | 6ª: "Muitas tentativas de login. Aguarde 5 minutos para tentar de novo."; botão desabilitado | Passed | `ct02b_login_429_bloqueio_1440.png` |
| CT04 | RF01 | Logar como `coseg` (com `volta=/painel/`) | 200 e abre `/painel/` | Abriu `/painel/` ("Boa tarde, Carla", menu com Painel e Gestão) | Passed | `ct03_login_coseg_painel_1440.png` |
| CT05 | RF01, RF05 | Logar como `colaborador` | Abre `/reservas/`; sem Painel/Gestão no menu | Abriu `/reservas/`; menu: Frota, Reservas, Nova reserva | Passed | `ct03b_login_colaborador_reservas_sem_excluir_1440.png` |
| CT06 | RF01, RN18 | Logado como `colaborador`, abrir `/painel/` | Redireciona para `/reservas/` | Redirecionou para `/reservas/` | Passed | `ct03c_colaborador_painel_redireciona_1440.png` |
| CT07 | RF02 | Clicar em "Sair" | Volta ao login; `GET /api/eu/` responde 401 | Foi para `/entrar/`; `/api/eu/` = 401 | Passed | `ct04_logout_volta_ao_login_1440.png` |

## 2. CRUD de reserva (RF05 a RF10)

| ID | RF/RN | Passos | Esperado | Obtido | Resultado | Captura |
|---|---|---|---|---|---|---|
| CT08 | RF06, RF07, RF14 | COSEG: Nova reserva, VL-06, 2 pax, 10/11/2026 08:00–10:00, escolher VL-06 e enviar | 201; "Reserva registrada com sucesso"; mostra veículo; lista atualiza | Toast "Reserva registrada com sucesso · veículo VL-06."; painel "Livres no seu horário" listou 9 veículos; item na lista | Passed | `ct05_reserva_criar_veiculo_form_1440.png`, `ct05_reserva_criada_toast_lista_1440.png` |
| CT09 | RF06, RN11 | Nova reserva por Categoria COLETIVO, 10 pax, 15/11/2026 08:00–10:00 | 201 e mostra o veículo atribuído | Toast "Reserva registrada com sucesso · veículo VC-01." (menor livre) | Passed | `ct06_criar_por_categoria_atribuiu_VC01_1440.png` |
| CT10 | RF05 | COSEG: listar `/reservas/`; buscar "luffy" | Lista todas; busca filtra por pessoa/atividade | 20 reservas (16 originais + 4 minhas); busca devolveu 4 | Passed | `ct15_listar_buscar_1440.png` |
| CT11 | RF05 | Filtrar veículo VC-01; aba Canceladas | Filtro local por veículo/status; cancelada com selo e sem Editar/Cancelar | VC-01 mostrou só as 2 reservas; Cancelada: selo "Cancelada", ações só Ver e Excluir | Passed | `ct16_filtro_canceladas_sem_editar_cancelar_1440.png` |
| CT13 | RF05 | Clicar no olho (Ver) de uma reserva | Detalhe com todos os dados | Diálogo "Reserva 18 · VL-06" com situação, veículo, solicitante, horários, criador | Passed | `ct17_detalhe_reserva_1440.png` |
| CT14 | RF08 | Editar reserva: mudar atividade e hora de retorno para 11:00, salvar | PATCH 200; "Reserva atualizada" | PATCH 200 (só campos alterados); toast "Reserva atualizada · veículo VL-06."; GET confirmou dados | Passed | `ct18_editar_reserva_form_1440.png`, `ct18_editar_reserva_salva_toast_1440.png` |
| CT15 | RF09, RN14 | Cancelar com confirmação | Diálogo de confirmação; "Reserva cancelada. O veículo foi liberado"; selo Cancelada | Diálogo ok; toast ok (conferido com captura imediata, o toast some em ~5 s); item "Cancelada" | Passed | `ct19_cancelar_confirmacao_1440.png`, `ct19_cancelada_toast_selo_1440.png`, `ct19b_cancelar_toast_sucesso_1440.png` |
| CT17 | RF10 | COSEG: Excluir reserva, confirmar | Confirmação; "Reserva excluída"; sai da lista | Diálogo com aviso de definitivo; toast "Reserva excluída."; item sumiu; `GET /api/reservas/18/` = 404 | Passed | `ct23_excluir_confirmacao_1440.png`, `ct23_excluir_toast_removida_1440.png` |
| CT18 | RF10, RN18 | Colaborador: lista sem botão Excluir; só vê as próprias; DELETE direto na API | Sem "Excluir"; 403 `sem_permissao` | 0 botões Excluir; só 4 reservas dele (`colaborador2` também só as dele, 4); DELETE = 403 "Somente o COSEG exclui reservas. Use /cancelar/." e nada removido | Passed | `ct03b_login_colaborador_reservas_sem_excluir_1440.png` (verificação de API no console, sem captura) |

## 3. Mensagens do servidor (RF06, RF08, RF09, RF14, RN01–RN19)

| ID | RF/RN | Passos | Esperado | Obtido | Resultado | Captura |
|---|---|---|---|---|---|---|
| CT19 | RN13, 409 | Reservar VL-06 em 10/11 09:00–11:00 (sobrepõe a de 08:00–10:00) | "O veículo VL-06 já está reservado nesse intervalo. Escolha outro horário, outro veículo ou deixe só a categoria."; dados mantidos; foco no campo | Aviso no topo e no campo Veículo com o texto exato; dados mantidos; foco em `veiculo` | Passed | `ct07_conflito_horario_409_1440.png` |
| CT20 | RN01, 400 | Categoria Leve, 7 pax | "A categoria Leve comporta até 4 passageiros. Para 7 pessoas, escolha Coletivo." | Texto exato no topo e no campo passageiros | Passed | `ct08_capacidade_7_pessoas_leve_400_1440.png` |
| CT21 | RN02, 400 | Veículo VL-06, 7 pax | "O veículo VL-06 comporta 4 passageiros e você informou 7. Escolha um veículo de maior capacidade." | Texto exato | Passed | `ct08b_capacidade_veiculo_VL06_400_1440.png` |
| CT22 | RN03, 400 | Categoria Coletivo, 19 pax | "O máximo é de 18 passageiros por reserva." | Texto exato | Passed | `ct08c_acima_18_passageiros_1440.png` |
| CT23 | RN07, 400 | Saída 10:00, retorno 09:00 | "O horário de retorno precisa ser depois do horário de saída. Se a viagem passa da meia-noite, informe também a data de retorno." | Texto exato no campo hora de retorno | Passed | `ct09_retorno_antes_da_saida_1440.png` |
| CT24 | RN05, 400 | Data 01/10/2026 (passado) | "Escolha a data de hoje ou uma data futura." | Texto exato no campo data (o servidor está com a RN05 ativa neste ambiente) | Passed | `ct10_data_passada_1440.png` |
| CT25 | RN10, RF06 | Sem veículo e sem categoria, enviar | "Escolha um veículo ou uma categoria." | Aviso "Preencha os campos obrigatórios" + mensagem no campo veículo; foco nele | Passed | `ct11_sem_veiculo_nem_categoria_1440.png` |
| CT26 | RN11, 409 `sem_veiculo_disponivel` | Ocupar VC-01 e VC-02 em 15/11 08:00–10:00 e pedir um 3º Coletivo | "Não há veículo Coletivo livre nesse período. Tente outro horário ou outra categoria." | Texto exato no campo Categoria; painel de disponibilidade já mostrava "Nenhum veículo disponível" | Passed | `ct12_sem_veiculo_disponivel_409_1440.png` |
| CT27 | RN08, 400 | VL-04 (inativo): a tela não lista; forçado via API (400 `veiculo_inativo`) e via formulário com opção injetada | Front não oferece VL-04; ao forçar: "O veículo VL-04 está inativo. Escolha outro veículo ou uma categoria." | Select sem VL-04; formulário com opção injetada mostrou o texto exato | Passed | `ct13_veiculo_inativo_VL04_400_1440.png` |
| CT28 | RN12, RF08 | Abrir `/reservas/{id}/editar/` de reserva cancelada | Mensagem da RN12; sem editar | "Esta reserva foi cancelada e não pode mais ser editada. Faça uma nova reserva."; campos e botão desabilitados | Passed | `ct21_editar_cancelada_409_1440.png` |
| CT29 | RN14, 409 `ja_cancelada` | Lista desatualizada: cancelar pela API e depois clicar Cancelar na tela | "Esta reserva já estava cancelada" e recarrega | Toast info "Esta reserva já estava cancelada."; lista recarregou | Passed | `ct22_ja_cancelada_409_1440.png` |
| CT30 | RN18, 403 | `colaborador` abre `/reservas/5/editar/` (de outro usuário) | "Você só pode acessar as suas próprias reservas." | Aviso "Não foi possível abrir a reserva / Você só pode acessar as suas próprias reservas."; API: GET, cancelar e DELETE em reserva alheia = 403 | Passed | `ct31_colaborador_reserva_alheia_403_1440.png` |
| CT31 | Seção 6, RF06 | Coletivo VC-01 com 3 pax em 20/11 | Sucesso + aviso amarelo não bloqueante | Toast sucesso e toast "Reserva registrada. Atenção: O veículo VC-01 é coletivo (18 lugares) e a reserva tem apenas 3 passageiro(s). Um veículo leve atenderia." | Passed | `ct14_aviso_coletivo_poucos_passageiros_1440.png` |

## 4. Frota (RF04, RF11, RF12, RF13)

| ID | RF/RN | Passos | Esperado | Obtido | Resultado | Captura |
|---|---|---|---|---|---|---|
| CT32 | RF04 | COSEG abre `/frota/?gestao=1` | Lista com categoria, capacidade, Inativo | 10 veículos agrupados em Coletivos e Leves; VL-04 "Inativo"; filtros Todos/Livres/Em uso/Inativos | Passed | `ct24_frota_coseg_listagem_1440.png` |
| CT33 | RF11 | Cadastrar `TESTE-V1`, Leve, ativo | 201; aparece na frota com capacidade | Toast "Veículo TESTE-V1 cadastrado."; detalhe: Leve, 4 lugares, Ativo, ações Editar/Desativar/Excluir | Passed | `ct25_veiculo_cadastrado_1440.png`, `ct25b_veiculo_detalhe_acoes_coseg_1440.png` |
| CT34 | RF11, 400 | Cadastrar com código `VL-01` | Erro no campo código | "Já existe um veículo com este código." no campo; diálogo permanece; foco no código | Passed | `ct26_veiculo_codigo_duplicado_400_1440.png` |
| CT35 | RF12 | Editar `TESTE-V1` para Coletivo | 200; capacidade 18 | Toast "Veículo atualizado."; Coletivo, 18 lugares | Passed | `ct27_veiculo_editar_categoria_coletivo_1440.png` |
| CT36 | RF12, RN17, 400 | Com reserva de 10 pax em `TESTE-V1`, voltar a categoria para Leve | Mensagem da RN17; mantém categoria anterior | Texto exato da RN17; categoria continuou Coletivo | Passed | `ct28_veiculo_reservas_incompativeis_RN17_1440.png` |
| CT37 | RF12 | Desativar e depois Ativar `TESTE-V1` (com confirmação) | "Inativo" e depois "Ativo" | Toasts "TESTE-V1 desativado." / "TESTE-V1 ativado."; selo Inativo e depois Ativo | Passed | `ct29_veiculo_desativado_inativo_1440.png`, `ct29b_veiculo_reativado_ativo_1440.png` |
| CT38 | RF13, RN15, 409 | Excluir `TESTE-V1` com reserva | Mensagem da RN15 e oferta de "Desativar" | Diálogo "Não foi possível excluir" com o texto da RN15 e botão "Desativar veículo" | Passed | `ct30_excluir_veiculo_com_reservas_409_1440.png` |
| CT39 | RF04, RN18 | Colaborador em `/frota/`; POST em `/api/veiculos/` | Sem Cadastrar/Editar/Excluir; 403 na API | Botão Cadastrar oculto, 0 ações, texto "Somente consulta"; API 403 "Acesso restrito ao COSEG." | Passed | `ct32_frota_colaborador_somente_leitura_1440.png` |

## 5. Painel do dia (RF03)

| ID | RF/RN | Passos | Esperado | Obtido | Resultado | Captura |
|---|---|---|---|---|---|---|
| CT40 | RF03, RNF04 | Comparar painel com `GET /api/reservas/?data=2026-10-27` (o valor `hoje` do enunciado da rodada devolve 400 `data_invalida`, só aceita AAAA-MM-DD) | Números do painel batem | API: 6 reservas, 3 em uso agora (VC-02, VL-03, VL-05, às 16:48); painel: "Reservas hoje 6", "Em uso agora 3", "Livres agora 6" (de 9 ativos), "Próximo retorno VC-02 às 17:20", timeline com as 6 reservas | Passed | `ct03_login_coseg_painel_1440.png` |

## 6. Responsividade (RF/RNF03)

| ID | RF/RN | Passos | Esperado | Obtido | Resultado | Captura |
|---|---|---|---|---|---|---|
| CT42 | RNF03 | Abrir Entrar, Painel, Reservas, Nova reserva e Frota em 1440, 768 e 360 px; medir `scrollWidth` x `clientWidth` | Sem rolagem horizontal da página | Nenhuma tela com overflow em nenhuma largura. A faixa da semana e a linha do tempo rolam dentro do próprio componente (esperado) | Passed | `ct33_resp_painel_768_e_360.png`, `ct33_resp_reservas_768_e_360.png`, `ct33_resp_nova_reserva_768_e_360.png`, `ct33_resp_frota_768_e_360.png`, `ct33_resp_entrar_768_e_360.png` (1440: capturas das seções anteriores) |
| CT43 | RNF03 | Em 360 e 768, ver o menu; abrir o menu no celular | Menu vira barra superior com botão; abre com os links | Barra sticky no topo (325x62 em 360) com botão hambúrguer; aberto lista Painel, Frota, Reservas, Nova reserva, Veículos | Passed | `ct33_resp_menu_aberto_360.png` |

## 7. Console

| ID | RF/RN | Passos | Esperado | Obtido | Resultado | Captura |
|---|---|---|---|---|---|---|
| CT44 | RNF | Ler o console durante toda a rodada | Sem erro de JavaScript | Nenhum erro de JS do app. Só "Failed to load resource" de 400/401/403/409/429 provocados | Passed | `ct02b_login_429_bloqueio_1440.png` (console no log do teste) |

## 8. Integração (RNF04, RNF05, RNF06), resumo das requisições observadas

| Ação | Requisição | Status |
|---|---|---|
| Login | `POST /api/login/` (com CSRF) | 200 / 401 / 429 |
| Sessão | `GET /api/eu/` | 200 / 401 |
| Painel | `GET /api/veiculos/`, `GET /api/reservas/?data=hoje e ontem` | 200 |
| Lista | `GET /api/reservas/` (sem filtros) | 200 |
| Disponibilidade | `GET /api/disponibilidade/?data=&saida=&retorno=&passageiros=` | 200 / 400 |
| Criar | `POST /api/reservas/` | 201 / 400 / 409 |
| Editar | `GET` + `PATCH /api/reservas/{id}/` (só campos alterados) | 200 |
| Cancelar | `POST /api/reservas/{id}/cancelar/` | 200 / 409 |
| Excluir | `DELETE /api/reservas/{id}/` | 200 / 403 / 404 |
| Frota | `POST /api/veiculos/`, `PATCH`/`DELETE /api/veiculos/{id}/` | 201 / 200 / 400 / 409 / 403 |

A tela só mudou depois da resposta do servidor em todos os casos observados (RNF06).

## 9. Limpeza do banco de demonstração

Feita ao final como `coseg`. Banco voltou ao estado anterior: 16 reservas (ids 1 a 16, só a #13 cancelada), 10 veículos (VL-04 inativo).

- Reservas criadas e removidas (todas com solicitante "TESTE Luffy ..."): #18 (excluída pela tela), #19, #20, #21 e #22 (canceladas quando ativas e excluídas via API).
- Veículo criado e removido: `TESTE-V1`.
- Nenhuma credencial foi criada ou alterada nesta rodada.
