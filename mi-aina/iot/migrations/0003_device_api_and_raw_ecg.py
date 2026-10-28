from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ('iot', '0002_measure_optional_sensor_values'),
    ]

    operations = [
        migrations.AlterField(
            model_name='device',
            name='code',
            field=models.CharField(max_length=64, unique=True),
        ),
        migrations.AddField(
            model_name='device',
            name='actif',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='device',
            name='token_hash',
            field=models.CharField(blank=True, default='', max_length=128),
        ),
        migrations.AddField(
            model_name='device',
            name='derniere_communication',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='measure',
            name='ecg_brut',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='measure',
            name='electrodes_connectees',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='measure',
            name='event_id',
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='measure',
            name='captured_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddConstraint(
            model_name='measure',
            constraint=models.UniqueConstraint(
                condition=Q(event_id__isnull=False),
                fields=('device', 'event_id'),
                name='uniq_iot_measure_device_event',
            ),
        ),
    ]
