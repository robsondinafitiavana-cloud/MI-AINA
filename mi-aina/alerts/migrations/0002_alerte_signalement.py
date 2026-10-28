from django.db import migrations, models
import django.db.models.deletion


def create_alerts_for_existing_reports(apps, schema_editor):
    Signalement = apps.get_model('reports', 'Signalement')
    Alerte = apps.get_model('alerts', 'Alerte')
    for report in Signalement.objects.filter(statut='TRANSMIS').select_related('agent__csb').iterator():
        reporter = report.agent
        district = reporter.district or (reporter.csb.district if reporter.csb_id else '')
        region = reporter.region or (reporter.csb.region if reporter.csb_id else '')
        structure = reporter.csb.nom if reporter.csb_id else (reporter.etablissement or reporter.direction or 'Structure non renseignée')
        role = reporter.get_role_display()
        location = ' · '.join(part for part in [district, region] if part) or 'Localisation non renseignée'
        note = f' · {report.note}' if report.note else ''
        Alerte.objects.create(
            niveau='crit' if report.nb_cas >= 5 else 'warn' if report.nb_cas >= 3 else 'info',
            tag='TRANSMISSION',
            titre=f'Signalement — {report.type}',
            description=f'{report.village} · {report.nb_cas} cas · {reporter.prenom} {reporter.nom} ({role}) · {structure} · {location}{note}',
            signalement_id=report.pk,
        )


class Migration(migrations.Migration):
    dependencies = [
        ('alerts', '0001_initial'),
        ('reports', '0003_signalement_pris_en_charge'),
    ]

    operations = [
        migrations.AddField(
            model_name='alerte',
            name='signalement',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='alertes_pilotage',
                to='reports.signalement',
            ),
        ),
        migrations.RunPython(create_alerts_for_existing_reports, migrations.RunPython.noop),
    ]
