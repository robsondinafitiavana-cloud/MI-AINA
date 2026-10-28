from django.db import models


class Region(models.Model):
    nom = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ['nom']
        verbose_name = 'Région'
        verbose_name_plural = 'Régions'

    def __str__(self):
        return self.nom


class District(models.Model):
    nom = models.CharField(max_length=100)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='districts')

    class Meta:
        ordering = ['region__nom', 'nom']
        constraints = [
            models.UniqueConstraint(fields=['region', 'nom'], name='unique_district_par_region'),
        ]
        verbose_name = 'District'
        verbose_name_plural = 'Districts'

    def __str__(self):
        return f'{self.nom} · {self.region.nom}'


class CSB(models.Model):
    """Centre de Santé de Base.

    Les champs facultatifs (téléphone, adresse, coordonnées, photo) restent
    VIDES tant que le Pilotage ne les saisit pas : aucune donnée inventée.
    """
    code     = models.CharField(max_length=10, unique=True)   # CSB001…
    nom      = models.CharField(max_length=150)               # CSB Ambohipo
    district = models.CharField(max_length=100)
    region   = models.CharField(max_length=100)
    # --- informations facultatives : affichées seulement si renseignées ---
    telephone = models.CharField(max_length=30, blank=True)
    adresse   = models.CharField(max_length=200, blank=True)
    latitude  = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    photo_url = models.URLField(max_length=400, blank=True)
    maj_le    = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'CSB'

    def __str__(self): return f'{self.nom} ({self.code})'