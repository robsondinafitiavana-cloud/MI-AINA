from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('publications', '0002_alter_publication_auteur')]

    operations = [
        migrations.AlterField(
            model_name='publication',
            name='type',
            field=models.CharField(choices=[('texte', 'Texte'), ('image', 'Image'), ('video', 'Vidéo'), ('pdf', 'Guide PDF'), ('protocole', 'Protocole')], default='texte', max_length=10),
        ),
    ]
