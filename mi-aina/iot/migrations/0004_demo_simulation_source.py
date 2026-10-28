from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('iot', '0003_device_api_and_raw_ecg')]

    operations = [
        migrations.AddField(
            model_name='device', name='is_simulated',
            field=models.BooleanField(default=False, help_text='Boîtier virtuel réservé aux démonstrations.'),
        ),
        migrations.AddField(
            model_name='measure', name='source',
            field=models.CharField(choices=[('REAL', 'Matériel réel'), ('SIMULATION', 'Simulation')], default='REAL', max_length=12),
        ),
        migrations.AddField(
            model_name='measure', name='ecg_signal',
            field=models.JSONField(blank=True, help_text='Fenêtre ECG synthétique (source SIMULATION uniquement).', null=True),
        ),
    ]
