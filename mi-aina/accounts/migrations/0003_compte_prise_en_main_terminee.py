from django.db import migrations, models


def mark_previous_agent_logins_complete(apps, schema_editor):
    Compte = apps.get_model('accounts', 'Compte')
    Compte.objects.filter(
        role='PREMIERE_LIGNE',
        derniere_connexion__isnull=False,
    ).update(prise_en_main_terminee=True)


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0002_compte_photo'),
    ]

    operations = [
        migrations.AddField(
            model_name='compte',
            name='prise_en_main_terminee',
            field=models.BooleanField(
                default=False,
                help_text='Indique si le centre d’aide de première connexion a été parcouru ou passé.',
                verbose_name='Prise en main MI-AINA terminée',
            ),
        ),
        migrations.RunPython(mark_previous_agent_logins_complete, migrations.RunPython.noop),
    ]
