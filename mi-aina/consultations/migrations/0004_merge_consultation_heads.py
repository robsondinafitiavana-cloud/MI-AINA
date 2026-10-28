from django.db import migrations


class Migration(migrations.Migration):
    # Join the existing ordonnance and preferred-doctor branches. Both branches
    # add independent fields, so their operations are preserved as-is.
    dependencies = [
        ('consultations', '0002_consultation_medecin_prefere'),
        ('consultations', '0003_consultation_agent_modified_and_more'),
    ]

    operations = []
