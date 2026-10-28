from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='DiseasePrevention',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=180, unique=True, verbose_name='Maladie')),
                ('slug', models.SlugField(max_length=200, unique=True)),
                ('description', models.TextField(blank=True, verbose_name='Description')),
                ('transmission', models.TextField(blank=True, verbose_name='Mode de transmission')),
                ('risk_factors', models.TextField(blank=True, verbose_name='Facteurs de risque')),
                ('recommended_actions', models.TextField(blank=True, verbose_name='Gestes recommandés')),
                ('entourage_protection', models.TextField(blank=True, verbose_name='Protection de l’entourage')),
                ('warning_signs', models.TextField(blank=True, verbose_name='Signes d’alerte')),
                ('when_to_consult', models.TextField(blank=True, verbose_name='Quand consulter ou orienter')),
                ('source', models.TextField(blank=True, verbose_name='Source de l’information')),
                ('verified_at', models.DateField(blank=True, null=True, verbose_name='Date de vérification')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Fiche de prévention',
                'verbose_name_plural': 'Fiches de prévention',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='PreventionMeasure',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField(verbose_name='Précaution / mesure de prévention')),
                ('position', models.PositiveSmallIntegerField(default=0)),
                ('disease', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='precautions', to='prevention.diseaseprevention')),
            ],
            options={
                'verbose_name': 'Précaution',
                'verbose_name_plural': 'Précautions',
                'ordering': ['position', 'pk'],
            },
        ),
        migrations.AddConstraint(
            model_name='preventionmeasure',
            constraint=models.UniqueConstraint(fields=('disease', 'position'), name='prevention_measure_pos_uq'),
        ),
    ]
