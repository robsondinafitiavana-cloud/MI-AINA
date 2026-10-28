from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('iot', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='measure',
            name='spo2',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='measure',
            name='temperature',
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=4, null=True),
        ),
        migrations.AlterField(
            model_name='measure',
            name='bpm',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
