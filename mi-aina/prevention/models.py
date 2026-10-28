from django.db import models


class DiseasePrevention(models.Model):
    """Fiche de prévention rattachée au libellé exact d’une classe du MLP."""

    name = models.CharField('Maladie', max_length=180, unique=True)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField('Description', blank=True)
    transmission = models.TextField('Mode de transmission', blank=True)
    risk_factors = models.TextField('Facteurs de risque', blank=True)
    recommended_actions = models.TextField('Gestes recommandés', blank=True)
    entourage_protection = models.TextField('Protection de l’entourage', blank=True)
    warning_signs = models.TextField('Signes d’alerte', blank=True)
    when_to_consult = models.TextField('Quand consulter ou orienter', blank=True)
    source = models.TextField('Source de l’information', blank=True)
    verified_at = models.DateField('Date de vérification', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Fiche de prévention'
        verbose_name_plural = 'Fiches de prévention'

    def __str__(self):
        return self.name


class PreventionMeasure(models.Model):
    disease = models.ForeignKey(
        DiseasePrevention, on_delete=models.CASCADE, related_name='precautions')
    text = models.TextField('Précaution / mesure de prévention')
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['position', 'pk']
        verbose_name = 'Précaution'
        verbose_name_plural = 'Précautions'
        constraints = [
            models.UniqueConstraint(fields=['disease', 'position'], name='prevention_measure_pos_uq'),
        ]

    def __str__(self):
        return f'{self.disease.name} — {self.position + 1}'
