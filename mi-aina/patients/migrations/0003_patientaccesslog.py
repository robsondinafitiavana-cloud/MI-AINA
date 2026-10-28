import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('patients', '0002_patient_csb'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PatientAccessLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True,
                                           serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('DOSSIER', 'Consultation du dossier'),
                                                     ('PDF', 'Export PDF')], max_length=12)),
                ('cree_le', models.DateTimeField(auto_now_add=True)),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                              related_name='access_logs', to='patients.patient')),
                ('utilisateur', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,
                                                  related_name='patient_access_logs',
                                                  to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-cree_le']},
        ),
        migrations.AddIndex(
            model_name='patientaccesslog',
            index=models.Index(fields=['patient', '-cree_le'], name='p_access_patient_date_idx'),
        ),
    ]
