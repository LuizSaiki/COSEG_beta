from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from reservas.models import Reserva, Veiculo

MARCA = "[DEMO]"  # prefixo em observacoes: identifica o que este comando criou


class Command(BaseCommand):
    help = "Recria as reservas de demonstração (relativas a hoje) e deixa VL-04 inativo"

    def handle(self, *args, **opts):
        User = get_user_model()
        usuarios = {u.username: u for u in User.objects.filter(
            username__in=["coseg", "colaborador", "colaborador2"])}
        if len(usuarios) < 3:
            raise CommandError("Rode antes: python manage.py criar_usuarios_teste")
        coseg, ana, diego = usuarios["coseg"], usuarios["colaborador"], usuarios["colaborador2"]

        call_command("seed_dados", verbosity=0)  # garante a frota VL-01..08 e VC-01..02
        Veiculo.objects.filter(codigo="VL-04").update(ativo=False)
        veiculos = {v.codigo: v for v in Veiculo.objects.all()}

        agora = timezone.localtime().replace(second=0, microsecond=0, tzinfo=None)
        agora -= timedelta(minutes=agora.minute % 5)
        hoje = agora.date()

        def rel(h_ini, h_fim):  # período relativo a agora (em horas)
            return agora + timedelta(hours=h_ini), agora + timedelta(hours=h_fim)

        def dia(n, h1, h2):  # período em hoje+n, horas cheias
            d = datetime.combine(hoje + timedelta(days=n), time())
            return d + timedelta(hours=h1), d + timedelta(hours=h2)

        # (veículo, período, solicitante, setor, atividade, origem, destino, pax, criado_por, tipo)
        # tipo: "passada" / "andamento" (bypass) | "futura" | "cancelada" (validação normal)
        plano = [
            ("VL-01", rel(-7, -5), "Marcos Teixeira", "Operações", "Vistoria do berço 105",
             "Portaria principal", "Berço 105", 3, coseg, "passada"),
            ("VC-01", rel(-6, -3), "Fernanda Lima", "Segurança do Trabalho", "Treinamento NR-35",
             "Portaria principal", "Centro de treinamento", 14, ana, "passada"),
            ("VL-02", rel(-4, -2), "Paulo Andrade", "Manutenção", "Inspeção de guindaste",
             "Oficina central", "Pátio de contêineres", 2, diego, "passada"),
            ("VL-03", rel(-1, 2), "Juliana Castro", "Meio Ambiente", "Monitoramento ambiental",
             "Prédio administrativo", "Terminal de grãos", 4, ana, "andamento"),
            ("VC-02", rel(-2, 1), "Roberto Nunes", "Recursos Humanos", "Transporte de turno",
             "Portaria principal", "Terminal de fertilizantes", 16, diego, "andamento"),
            ("VL-05", rel(-0.5, 3), "Camila Rocha", "Comercial", "Visita de cliente ao cais",
             "Prédio administrativo", "Cais 102", 3, coseg, "andamento"),
            ("VL-01", dia(1, 8, 10), "Marcos Teixeira", "Operações", "Reunião de planejamento de atracação",
             "Prédio administrativo", "Capitania dos Portos", 3, ana, "futura"),
            ("VC-01", dia(1, 13, 16), "Sandra Oliveira", "Segurança Patrimonial", "Integração de prestadores",
             "Portaria principal", "Auditório do porto", 12, diego, "futura"),
            ("VL-08", dia(1, 10, 12), "Eduardo Pires", "Logística", "Conferência de carga",
             "Prédio administrativo", "Terminal de grãos", 2, coseg, "cancelada"),
            ("VL-06", dia(2, 9, 12), "Helena Barbosa", "Engenharia", "Inspeção de obra do píer",
             "Prédio administrativo", "Píer 2", 4, ana, "futura"),
            ("VL-07", dia(2, 14, 17), "Ricardo Souza", "Tecnologia da Informação", "Manutenção de câmeras",
             "Sala de TI", "Portaria principal", 2, diego, "futura"),
            ("VC-02", dia(3, 8, 12), "Patrícia Gomes", "Segurança do Trabalho", "Simulado de emergência",
             "Portaria principal", "Área de abandono", 17, coseg, "futura"),
        ]

        self._checar_sobreposicao(plano)

        with transaction.atomic():
            apagadas, _ = Reserva.objects.filter(observacoes__startswith=MARCA).delete()
            for cod, (ini, fim), sol, setor, ativ, orig, dest, pax, autor, tipo in plano:
                r = Reserva(
                    veiculo=veiculos[cod], data=ini.date(), hora_saida=ini.time(),
                    data_retorno=fim.date() if fim.date() != ini.date() else None,
                    hora_retorno=fim.time(), solicitante=sol, setor=setor, atividade=ativ,
                    origem=orig, destino=dest, passageiros=pax, criado_por=autor,
                    observacoes=f"{MARCA} reserva de demonstração",
                )
                if tipo in ("passada", "andamento"):
                    r.save(validar=False)  # já começou: a validação normal recusaria o passado
                else:
                    r.save()
                    if tipo == "cancelada":
                        r.cancelar()

        self.stdout.write(self.style.SUCCESS(
            f"{len(plano)} reservas de demonstração criadas ({apagadas} anteriores removidas). "
            "VL-04 está inativo."))

    def _checar_sobreposicao(self, plano):
        por_veiculo = {}
        for cod, (ini, fim), *_, tipo in plano:
            if tipo != "cancelada":
                por_veiculo.setdefault(cod, []).append((ini, fim))
        # reservas reais já existentes (não-demo) também contam
        for r in Reserva.objects.filter(status=Reserva.Status.ATIVA).exclude(
                observacoes__startswith=MARCA).select_related("veiculo"):
            if r.veiculo.codigo in por_veiculo:
                por_veiculo[r.veiculo.codigo].append((r.inicio, r.fim))
        for cod, periodos in por_veiculo.items():
            periodos.sort()
            for (_, fim_a), (ini_b, _) in zip(periodos, periodos[1:]):
                if ini_b < fim_a:
                    raise CommandError(f"Sobreposição de horários no veículo {cod}; ajuste o plano.")
