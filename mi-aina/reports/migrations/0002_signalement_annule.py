from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('reports', '0001_initial')]

    operations = [
        migrations.AlterField(
            model_name='signalement',
            name='statut',
            field=models.CharField(choices=[('TRANSMIS', 'Transmis'), ('EN ATTENTE SYNC', 'En attente sync'), ('ANNULE', 'Annulé')], default='TRANSMIS', max_length=16),
        ),
    ]
