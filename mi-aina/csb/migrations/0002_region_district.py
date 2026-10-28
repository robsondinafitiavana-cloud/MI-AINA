from django.db import migrations, models
import django.db.models.deletion


def create_territory_from_csbs(apps, schema_editor):
    Region = apps.get_model('csb', 'Region')
    District = apps.get_model('csb', 'District')
    CSB = apps.get_model('csb', 'CSB')
    for row in CSB.objects.values('region', 'district').distinct():
        if not row['region'] or not row['district']:
            continue
        region, _ = Region.objects.get_or_create(nom=row['region'])
        District.objects.get_or_create(nom=row['district'], region=region)


class Migration(migrations.Migration):
    dependencies = [('csb', '0001_initial')]

    operations = [
        migrations.CreateModel(
            name='Region',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=100, unique=True)),
            ],
            options={'ordering': ['nom'], 'verbose_name': 'Région', 'verbose_name_plural': 'Régions'},
        ),
        migrations.CreateModel(
            name='District',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=100)),
                ('region', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                             related_name='districts', to='csb.region')),
            ],
            options={'ordering': ['region__nom', 'nom'], 'verbose_name': 'District', 'verbose_name_plural': 'Districts'},
        ),
        migrations.AddConstraint(
            model_name='district',
            constraint=models.UniqueConstraint(fields=('region', 'nom'), name='unique_district_par_region'),
        ),
        migrations.RunPython(create_territory_from_csbs, migrations.RunPython.noop),
    ]