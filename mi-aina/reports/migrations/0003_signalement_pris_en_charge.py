from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('reports', '0002_signalement_annule'),
    ]

    operations = [
        migrations.AlterField(
            model_name='signalement',
            name='statut',
            field=models.CharField(
                choices=[
                    ('TRANSMIS', 'Transmis'),
                    ('EN ATTENTE SYNC', 'En attente sync'),
                    ('PRIS_EN_CHARGE', 'Pris en charge'),
                    ('ANNULE', 'Annulé'),
                ],
                default='TRANSMIS',
                max_length=16,
            ),
        ),
    ]
